const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const {
  PRICING_DOC,
  DEFAULT_PRICING,
  normalizePricing,
  calculatePricing,
  loadPricing,
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
  const config = await loadPricing(getFirestore());
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
      annualMonths: config.annualMonths,
      discountType: config.discountType,
      discountValue: config.discountValue,
      vatMode: config.vatMode,
      vatRate: config.vatRate,
    });
    const db = getFirestore();
    await db.collection(PRICING_DOC.collection).doc(PRICING_DOC.id).set({
      ...config,
      updatedBy: request.auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
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
