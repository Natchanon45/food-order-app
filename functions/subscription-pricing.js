const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { readThresholdHistory, appendThresholdVersion, validCents } = require("./delivery-threshold-schedule");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const {
  PRICING_DOC,
  DEFAULT_PRICING,
  normalizePricing,
  calculatePricing,
  loadPricing,
  pricingSnapshot,
} = require("./subscription-pricing-core");

async function assertSuperAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const profile = (await getFirestore().collection("users").doc(auth.uid).get()).data();
  if (!profile || profile.active === false || profile.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Super admin permission required");
  }
}

function validate(raw = {}) {
  const config = normalizePricing(raw);
  if (!Number.isFinite(Number(raw.monthlyPrice)) || config.monthlyPrice <= 0 || config.monthlyPrice > 1000000) {
    throw new HttpsError("invalid-argument", "Monthly price is invalid");
  }
  for (const [key, maximum] of [["deliveryThreshold", 1000000000], ["deliveryShareRate", 100]]) {
    const value = Number(raw[key] ?? config[key]);
    if (!Number.isFinite(value) || value < 0 || value > maximum
      || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) {
      throw new HttpsError("invalid-argument", `Invalid ${key}`);
    }
  }
  // Missing quota from older admin clients retains the deployed 100-check default.
  const quota = raw.monthlySlipQuota ?? 100;
  if (!Number.isInteger(Number(quota)) || Number(quota) < 0 || Number(quota) > 1000000) {
    throw new HttpsError("invalid-argument", "Monthly Slip2Go quota must be a whole number");
  }
  if (!Number.isFinite(Number(raw.annualMonths)) || config.annualMonths < 1 || config.annualMonths > 60) {
    throw new HttpsError("invalid-argument", "Annual period is invalid");
  }
  if (!["none", "amount", "percent"].includes(String(raw.discountType || ""))) {
    throw new HttpsError("invalid-argument", "Discount type is invalid");
  }
  const annualBase = config.monthlyPrice * config.annualMonths;
  if (config.discountType === "percent" && config.discountValue > 100) {
    throw new HttpsError("invalid-argument", "Discount percent is invalid");
  }
  if (config.discountType === "amount" && config.discountValue > annualBase) {
    throw new HttpsError("invalid-argument", "Discount amount is invalid");
  }
  if (!["inclusive", "exclusive", "none"].includes(String(raw.vatMode || ""))) {
    throw new HttpsError("invalid-argument", "VAT mode is invalid");
  }
  if (!Number.isFinite(Number(raw.vatRate)) || config.vatRate < 0 || config.vatRate > 30) {
    throw new HttpsError("invalid-argument", "VAT rate is invalid");
  }
  return config;
}

exports.getPublicSubscriptionPricing = onCall({ region: "asia-southeast1" }, async () => {
  const config = normalizePricing(pricingSnapshot(await loadPricing(getFirestore())));
  return { ok: true, config, pricing: calculatePricing(config) };
});

exports.getSubscriptionPricing = onCall({ region: "asia-southeast1" }, async request => {
  await assertSuperAdmin(request.auth);
  const db = getFirestore();
  const ref = db.collection(PRICING_DOC.collection).doc(PRICING_DOC.id);
  const snapshot = await ref.get();
  const config = normalizePricing(snapshot.exists ? snapshot.data() : DEFAULT_PRICING);
  return { ok: true, exists: snapshot.exists, config, pricing: calculatePricing(config) };
});

exports.updateSubscriptionPricing = onCall({ region: "asia-southeast1" }, async request => {
  try {
    await assertSuperAdmin(request.auth);
    const config = validate(request.data || {});
    console.info("SUBSCRIPTION_PRICING_UPDATE_ATTEMPT", {
      uid: request.auth.uid,
      monthlyPrice: config.monthlyPrice,
      deliveryThreshold: config.deliveryThreshold,
      deliveryShareRate: config.deliveryShareRate,
      monthlySlipQuota: config.monthlySlipQuota,
      annualMonths: config.annualMonths,
      discountType: config.discountType,
      discountValue: config.discountValue,
      vatMode: config.vatMode,
      vatRate: config.vatRate,
    });
    const db = getFirestore();
    const ref = db.collection(PRICING_DOC.collection).doc(PRICING_DOC.id);
    await db.runTransaction(async tx => {
      const [profile, snapshot] = await Promise.all([tx.get(db.collection("users").doc(request.auth.uid)), tx.get(ref)]);
      if (profile.data()?.active === false || profile.data()?.role !== "super_admin") throw new HttpsError("permission-denied", "Super admin permission required");
      if (snapshot.exists) {
        const raw = snapshot.data();
        readThresholdHistory(raw);
        if (config.deliveryThreshold !== normalizePricing(raw).deliveryThreshold) throw new HttpsError("failed-precondition", "DELIVERY_THRESHOLD_BASELINE_LOCKED");
      }
      tx.set(ref, { ...config, updatedBy: request.auth.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    console.info("SUBSCRIPTION_PRICING_UPDATE_SUCCESS", {
      uid: request.auth.uid,
      document: `${PRICING_DOC.collection}/${PRICING_DOC.id}`,
    });
    return { ok: true, config, pricing: calculatePricing(config) };
  } catch (error) {
    console.warn("SUBSCRIPTION_PRICING_UPDATE_FAILED", {
      uid: request.auth?.uid || null,
      code: error?.code || null,
      message: String(error?.message || error || "").slice(0, 500),
    });
    throw error;
  }
});

// Same pricing document is the serialization point for ordinary edits and
// append-only threshold revisions. An unset master never fabricates a baseline.
exports.getDeliveryThresholdVersions = onCall({ region: "asia-southeast1" }, async request => {
  await assertSuperAdmin(request.auth);
  const snap = await getFirestore().collection(PRICING_DOC.collection).doc(PRICING_DOC.id).get();
  const raw = snap.data() || {};
  const baselineThresholdCents = Math.round(Number(raw.deliveryThreshold)*100);
  if (!snap.exists || !validCents(baselineThresholdCents)) throw new HttpsError("failed-precondition", "DELIVERY_THRESHOLD_MASTER_UNAVAILABLE");
  return {ok:true, baselineThresholdCents, versions:readThresholdHistory(raw), writeEnabled:true};
});
exports.appendDeliveryThresholdVersion = onCall({ region: "asia-southeast1" }, async request => {
  await assertSuperAdmin(request.auth);
  const db = getFirestore(), ref = db.collection(PRICING_DOC.collection).doc(PRICING_DOC.id);
  const version = await db.runTransaction(async tx => {
    const [profile,snap] = await Promise.all([tx.get(db.collection("users").doc(request.auth.uid)),tx.get(ref)]);
    if (profile.data()?.active === false || profile.data()?.role !== "super_admin") throw new HttpsError("permission-denied", "Super admin permission required");
    if (!snap.exists) throw new HttpsError("failed-precondition", "DELIVERY_THRESHOLD_MASTER_UNAVAILABLE");
    const raw = snap.data();
    let history;
    try {history = appendThresholdVersion(raw,request.data);} catch(error) {
      const code = String(error.message || "");
      if (code === "DELIVERY_THRESHOLD_HISTORY_INVALID") throw new HttpsError("failed-precondition",code);
      throw new HttpsError("invalid-argument",code);
    }
    tx.update(ref,{deliveryThresholdVersions:history,thresholdUpdatedBy:request.auth.uid,thresholdUpdatedAt:FieldValue.serverTimestamp()});
    return history.at(-1);
  });
  const confirmed = readThresholdHistory((await ref.get()).data() || {}).find(row=>row.effectiveOn===version.effectiveOn);
  if (!confirmed || confirmed.thresholdCents!==version.thresholdCents || confirmed.baselineThresholdCents!==version.baselineThresholdCents) throw new HttpsError("internal","DELIVERY_THRESHOLD_SCHEDULE_COMMIT_UNCONFIRMED");
  return {ok:true,...confirmed};
});
