const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { createHash } = require("node:crypto");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getMessaging } = require("firebase-admin/messaging");
const { inspectSlip } = require("./slip-verification");
const { allowManualReview } = require("./finance-manual-review-policy");
const { tenantAnchorDate, bangkokDateKey, cycleForDate } = require("./billing-anniversary");
const { verifiedCycleGoods, fingerprintOrder, reserveMerchantBillCheck,
  completeMerchantBillCheck } = require("./merchant-slip-quota");
const {
  slipDecision, normalizedItems, proofBoundToOrder, proofValidForOrder, kitchenAdmitted,
} = require("./delivery-slip-policy");

const REGION = "asia-southeast1";
const MAX_AMOUNT = 1000000;
const MATCHED = "matched";
const MANUAL_STATUSES = new Set(["manual_review", "config_required", "config_invalid"]);
const REJECTED_STATUSES = new Set(["duplicate", "mismatch", "invalid", "receiver_mismatch"]);
const amountCents = value => Math.round(Number(value) * 100);
const clean = (value, limit = 120) => String(value || "").trim().slice(0, limit);

async function cashierProfile(auth, tenantId) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  const snapshot = await getFirestore().collection("users").doc(auth.uid).get();
  const profile = snapshot.data() || {};
  if (!snapshot.exists || profile.active === false || String(profile.tenantId || "") !== tenantId
    || !["owner", "admin", "cashier", "manager"].includes(String(profile.role || ""))) {
    throw new HttpsError("permission-denied", "CASHIER_PERMISSION_REQUIRED");
  }
  return { uid: auth.uid, email: clean(auth.token?.email || profile.email, 180), role: String(profile.role || "") };
}
async function superAdminReviewer(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  const snapshot = await getFirestore().collection("users").doc(auth.uid).get();
  const profile = snapshot.data() || {};
  if (!snapshot.exists || profile.role !== "super_admin" || profile.active !== true) {
    throw new HttpsError("permission-denied", "SUPERADMIN_SLIP_REVIEW_ONLY");
  }
  return { uid: auth.uid, email: clean(profile.email || auth.token?.email, 180) };
}

// Technical fallback needs evidence returned by a REAL Slip2Go call, not just
// an uploaded image, a UI review flag, a configuration error or a Vision result.
function technicalDeliveryEvidence(result) {
  const primary = result?.provider === "slip2go_fallback_vision"
    ? result.primary : result;
  const evidence = {
    provider: clean(primary?.provider),
    status: clean(primary?.status),
    reason: clean(primary?.reason),
    code: clean(primary?.code, 30),
    fallbackAllowed: primary?.fallbackAllowed === true,
    amountMatched: primary?.amountMatched ?? null,
    receiverValidated: primary?.receiverValidated ?? null,
  };
  return allowManualReview({
    provider: "slip2go", status: "manual_review", proof: evidence,
  }) ? evidence : null;
}


exports.verifyDeliveryPaymentSlip = onCall(
  { region: REGION, timeoutSeconds: 65, memory: "512MiB", invoker: "public" },
  async request => {
    const tenantId = clean(request.data?.tenantId);
    const orderId = clean(request.data?.orderId);
    const slipPath = clean(request.data?.slipPath, 500);
    const amount = Number(request.data?.amount);
    const feeCents = amountCents(request.data?.deliveryFee);
    const rawItems = request.data?.items;
    if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 100
      || !Number.isInteger(feeCents) || feeCents < 0) {
      throw new HttpsError("invalid-argument", "DELIVERY_ITEMS_OR_FEE_INVALID");
    }
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(tenantId)
      || !/^[A-Za-z0-9_-]{8,128}$/.test(orderId)
      || !slipPath.startsWith(`tenants/${tenantId}/payment-slips/${orderId}/`)
      || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      throw new HttpsError("invalid-argument", "INVALID_DELIVERY_SLIP_REQUEST");
    }

    const db = getFirestore();
    const tenantRef = db.collection("tenants").doc(tenantId);
    const proofRef = tenantRef.collection("deliverySlipChecks").doc(orderId);
    const [tenantSnap, storeSnap, existingOrder, existingProof] = await Promise.all([
      tenantRef.get(), tenantRef.collection("settings").doc("store").get(),
      tenantRef.collection("orders").doc(orderId).get(), proofRef.get(),
    ]);
    const tenant = tenantSnap.data() || {};
    if (!tenantSnap.exists || tenant.active === false || tenant.businessType === "retail") {
      throw new HttpsError("failed-precondition", "RESTAURANT_DELIVERY_DISABLED");
    }
    if (existingOrder.exists) throw new HttpsError("already-exists", "DELIVERY_ORDER_ALREADY_EXISTS");

    const menuRows = await Promise.all(rawItems.map(async item => {
      const id = clean(item?.id, 128);
      const qty = Number(item?.qty);
      if (!id || !Number.isInteger(qty) || qty <= 0 || qty > 100) {
        throw new HttpsError("invalid-argument", "DELIVERY_ITEM_INVALID");
      }
      const menu = (await tenantRef.collection("menus").doc(id).get()).data();
      if (!menu || menu.active === false || !Number.isFinite(Number(menu.price))) {
        throw new HttpsError("failed-precondition", "DELIVERY_MENU_UNAVAILABLE");
      }
      return { id, qty, priceCents: amountCents(menu.price) };
    }));
    const foodCents = menuRows.reduce((sum, row) => sum + row.qty * row.priceCents, 0);
    const actualTotalCents = amountCents(amount);
    if (foodCents <= 0 || foodCents + feeCents !== actualTotalCents) {
      throw new HttpsError("failed-precondition", "DELIVERY_CHECKOUT_TOTAL_MISMATCH");
    }
    const itemsSignature = normalizedItems(menuRows);
    const blockedWithoutProvider = reason => ({
      status: "manual_review", reason, verification: "cashier",
      proofId: orderId, paymentVerified: false,
    });
    const manualProof = async reason => {
      // No real provider call: do NOT persist an approvable bank proof.
      console.info("DELIVERY_SLIP_NOT_CHECKED", { reason });
      return { status: "manual_review", reason, verification: "unverified",
        manualReviewEligible: false, paymentVerified: false, proofId: orderId };
    };

    // An accepted proof belongs to one immutable order amount, fee and cart.
    if (existingProof.exists && existingProof.data()?.status === MATCHED) {
      const proof = existingProof.data();
      const checkedAt = proof.checkedAt?.toMillis?.() || 0;
      if (proof.slipPath !== slipPath || proof.amountCents !== amountCents(amount)
        || proof.feeCents !== feeCents || proof.itemsSignature !== itemsSignature) {
        throw new HttpsError("failed-precondition", "ORDER_SLIP_ALREADY_VERIFIED");
      }
      if (!checkedAt || Date.now() - checkedAt > 15 * 60 * 1000) {
        return manualProof("verification_expired");
      }
      return { status: MATCHED, verification: "slip2go", proofId: orderId };
    }
    const settings = storeSnap.data() || {};
    const provider = clean(request.data?.deliveryProvider, 30);
    const latitude = Number(request.data?.latitude);
    const longitude = Number(request.data?.longitude);
    const quotationId = clean(request.data?.quotationId, 180);
    const freeShipping = settings.deliveryPromotion?.freeShipping || {};
    const freeApplied = freeShipping.enabled === true && Number(freeShipping.minimumSubtotal) > 0
      && foodCents >= amountCents(freeShipping.minimumSubtotal);
    let expectedFeeCents = null;
    if (provider === "lalamove" && quotationId) {
      const quote = (await tenantRef.collection("deliveryCheckoutQuotes").doc(quotationId).get()).data() || {};
      const expires = Date.parse(String(quote.expiresAt || ""));
      if (quote.quotationId === quotationId && quote.paymentMethod === "promptpay"
        && Number.isFinite(expires) && expires > Date.now()
        && Math.abs(Number(quote.latitude) - latitude) < 0.000001
        && Math.abs(Number(quote.longitude) - longitude) < 0.000001) {
        expectedFeeCents = freeApplied ? 0 : amountCents(quote.fee);
      }
    } else if (provider === "self") {
      const configured = Array.isArray(settings.deliveryFeeOptions) ? settings.deliveryFeeOptions : [];
      const manual = configured.find(item => String(item.id || item.key) === clean(request.data?.zoneId, 100));
      if (manual && (!Number.isFinite(Number(settings.storeLatitude)) || !Number.isFinite(Number(settings.storeLongitude)))) {
        expectedFeeCents = freeApplied ? 0 : amountCents(manual.fee ?? manual.amount);
      } else if (Number.isFinite(latitude) && Number.isFinite(longitude)
        && Number.isFinite(Number(settings.storeLatitude)) && Number.isFinite(Number(settings.storeLongitude))) {
        const key = [tenantId, Number(settings.storeLatitude).toFixed(5), Number(settings.storeLongitude).toFixed(5),
          latitude.toFixed(5), longitude.toFixed(5)].join("_").replace(/[^a-zA-Z0-9_.-]/g, "_");
        const route = (await db.collection("deliveryRouteCache").doc(key).get()).data() || {};
        const timestamp = route.updatedAt?.toMillis?.() || 0;
        const distance = Number(route.distanceMeters || 0);
        if (distance > 0 && timestamp && Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          const km = Math.round(distance / 10) / 100;
          const options = configured.filter(row => String(row.id || row.key) !== "pickup");
          const matched = options
            .map((row, index) => ({ fee: row.fee ?? row.amount, limit: Number(row.maxDistanceKm ?? row.distanceKm ?? row.maxDistance) || [2,5,10][index] || 10 }))
            .sort((a,b) => a.limit - b.limit)
            .find(row => km <= row.limit + 1e-9);
          if (matched) expectedFeeCents = freeApplied ? 0 : amountCents(matched.fee);
        }
      }
    }
    if (expectedFeeCents === null) return manualProof("delivery_fee_requires_cashier_review");
    if (expectedFeeCents !== feeCents) {
      return { status: "mismatch", reason: "delivery_fee_mismatch" };
    }

    const account = clean(settings.promptPayId, 40).replace(/[^0-9]/g, "");
    // Slip2Go receiver types 02001 = PromptPay phone, 02003 = national/tax ID.
    // Match the exact store's PromptPay proxy, never PENGUIN's central bank account.
    const receiverType = account.length === 10 ? "02001" : account.length === 13 ? "02003" : "";

    const bucketFile = getStorage().bucket().file(slipPath);
    const [exists] = await bucketFile.exists();
    if (!exists) throw new HttpsError("not-found", "SLIP_FILE_NOT_FOUND");
    const [metadata] = await bucketFile.getMetadata();
    const mime = clean(metadata.contentType, 100);
    const size = Number(metadata.size || 0);
    if (!mime.startsWith("image/") || size <= 0 || size > 8 * 1024 * 1024) {
      throw new HttpsError("invalid-argument", "INVALID_SLIP_IMAGE");
    }
    if (!receiverType) return manualProof("merchant_promptpay_receiver_not_supported");
    // Protect PENGUIN's central Slip2Go credit pool against burst abuse.
    const ip = clean(request.rawRequest?.ip || request.rawRequest?.headers?.["x-forwarded-for"] || "unknown", 180);
    const throttleId = createHash("sha256").update(tenantId + ":" + ip).digest("hex");
    const throttleRef = db.collection("platformSlipRateLimits").doc(throttleId);
    const rateAllowed = await db.runTransaction(async tx => {
      const snap = await tx.get(throttleRef);
      const row = snap.data() || {};
      const windowStart = Number(row.windowStart || 0);
      const currentWindow = Date.now() - windowStart < 5 * 60 * 1000;
      const count = currentWindow ? Number(row.count || 0) : 0;
      if (count >= 30) return false;
      tx.set(throttleRef, {
        tenantId, windowStart: currentWindow ? windowStart : Date.now(),
        count: count + 1, updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (!rateAllowed) return manualProof("slip2go_request_rate_limit");
    // The subscribed merchant quota covers unique REAL provider-checked
    // Delivery bills. Never charge an upload, an invalid platform key or
    // a repeated HTTP call on the same order.
    const [buffer] = await bucketFile.download();
    if (!Buffer.isBuffer(buffer) || buffer.length !== size) {
      throw new HttpsError("failed-precondition", "SLIP_IMAGE_BYTES_MISMATCH");
    }
    const orderBinding = fingerprintOrder({
      orderId, amountCents: actualTotalCents, foodCents, feeCents,
      itemsSignature, receiverAccount: account,
    });
    const anchor = tenantAnchorDate(tenant);
    if (!anchor) return blockedWithoutProvider("merchant_quota_activation_missing");
    const cycle = cycleForDate(anchor, bangkokDateKey(new Date()));
    if (!cycle) return blockedWithoutProvider("merchant_quota_activation_missing");
    const [priceSnap, verifierSnap, observed] = await Promise.all([
      db.collection("platformSettings").doc("subscriptionPricing").get(),
      db.collection("platformPrivateSettings").doc("slipVerification").get(),
      verifiedCycleGoods({ tenantRef, start: cycle.start, end: cycle.end }),
    ]);
    const price = priceSnap.data() || {};
    const providerSettings = verifierSnap.data() || {};
    const freeBills = Number(price.monthlySlipQuota);
    const thresholdCents = Math.round(Number(price.deliveryThreshold) * 100);
    if (!priceSnap.exists || !Number.isSafeInteger(freeBills)
      || freeBills < 0 || freeBills > 1000000
      || !Number.isSafeInteger(thresholdCents) || thresholdCents <= 0) {
      return blockedWithoutProvider("merchant_quota_pricing_unavailable");
    }
    if (!providerSettings.slip2GoApiUrl || !providerSettings.slip2GoSecret) {
      // No external verification was made: this is not a quota event.
      return manualProof("slip2go_config_required");
    }
    const slipSha256 = createHash("sha256").update(buffer).digest("hex");
    let reservation;
    try {
      reservation = await reserveMerchantBillCheck({
        db, tenantRef, tenant, orderId, slipSha256,
        orderFingerprint: orderBinding, goodsCents: observed.goodsCents,
        freeBills, thresholdCents,
      });
    } catch (error) {
      console.warn("MERCHANT_SLIP_QUOTA_RESERVATION_FAILED", error?.message || "unavailable");
      return { status: "manual_review", reason: "merchant_slip_quota_evidence_unavailable",
        verification: "cashier", proofId: orderId };
    }
    if (reservation.quotaExhausted) {
      // Do NOT persist a manual-approval proof: quota exhaustion is NOT
      // a technical Slip2Go outage after an actual provider call.
      return { status: "manual_review", reason: "merchant_slip_quota_exhausted",
        verification: "cashier", proofId: orderId };
    }
    if (!reservation.submitted) {
      // A previous provider check may already have spent credits. Never
      // initiate another call, including a retry during an in-flight result.
      const prior = reservation.prior || {};
      return { status: prior.status || "manual_review",
        reason: prior.reason || "prior_provider_check_unresolved",
        verification: "cashier", proofId: orderId };
    }
    const receiverOverride = { accountType: receiverType, accountNumber: account };
    const result = await inspectSlip(buffer, mime, slipPath.split("/").pop(), amount, {
      providerOverride: "slip2go", allowConfiguredFallback: true, receiverOverride,
    });
    const status = slipDecision(result);
    const reviewReason = status === "manual_review" && result.status === MATCHED
      ? "slip2go_verified_payload_incomplete" : clean(result.reason);
    try {
      await completeMerchantBillCheck({
        db, billRef: reservation.billRef, cycleRef: reservation.cycleRef,
        slipSha256, result, publicResult: {
          status, reason: reviewReason,
        },
      });
    } catch {
      // The result and quota may have committed on the server despite an
      // uncertain connection. Never duplicate the bank verification.
      return { status: "manual_review", reason: "merchant_quota_outcome_uncertain",
        verification: "cashier", proofId: orderId };
    }
    // An API-level success without a validated amount or a bank transaction
    // reference is NOT a verified payment. Preserve the exact reason.
    console.info("DELIVERY_SLIP_CHECK_RESULT", {
      status, reason: reviewReason, provider: clean(result.provider),
      code: clean(result.primaryCode || result.code),
      primaryReason: clean(result.primaryReason || result.reason),
    });
    if (["duplicate", "mismatch", "invalid", "receiver_mismatch"].includes(status)) {
      return { status, reason: clean(result.reason) };
    }
    const transRef = clean(result.transRef || result.referenceId, 200);
    const finalStatus = status === MATCHED ? MATCHED : "manual_review";
    const manualReviewEvidence = finalStatus === "manual_review"
      ? technicalDeliveryEvidence(result) : null;
    const proofData = {
      tenantId, orderId, slipPath, amountCents: amountCents(amount),
      foodCents, feeCents, itemsSignature,
      status: finalStatus, provider: clean(result.provider),
      reason: reviewReason,
      primaryReason: clean(result.primaryReason || ""),
      providerCode: clean(result.primaryCode || result.code || ""),
      checkedAt: FieldValue.serverTimestamp(), transRef,
      providerAttempted: true,
      manualReviewEligible: Boolean(manualReviewEvidence),
      manualReviewEvidence,
    };
    if (finalStatus === MATCHED) {
      const referenceKey = createHash("sha256").update(transRef).digest("hex");
      const uniqueRef = db.collection("platformSlipUsedReferences").doc(referenceKey);
      const uniqueResult = await db.runTransaction(async tx => {
        const existing = await tx.get(uniqueRef);
        if (existing.exists && (existing.data()?.tenantId !== tenantId || existing.data()?.orderId !== orderId)) {
          return false;
        }
        tx.set(uniqueRef, { tenantId, orderId, transRef, checkedAt: FieldValue.serverTimestamp() });
        tx.set(proofRef, proofData);
        return true;
      });
      if (!uniqueResult) return { status: "duplicate", reason: "slip2go_duplicate" };
    } else {
      await proofRef.set(proofData);
    }
    return { status: finalStatus, reason: reviewReason,
      verification: finalStatus === MATCHED ? "slip2go" : "unverified",
      manualReviewEligible: Boolean(manualReviewEvidence),
      paymentVerified: finalStatus === MATCHED, proofId: orderId };
  },
);

exports.finalizeDeliveryPaymentSlip = onDocumentCreated(
  { document: "tenants/{tenantId}/orders/{orderId}", region: REGION },
  async event => {
    const order = event.data?.data();
    if (!order || order.orderType !== "delivery" || order.paymentMethod !== "promptpay") return;
    const { tenantId, orderId } = event.params;
    const db = getFirestore();
    const orderRef = db.collection("tenants").doc(tenantId).collection("orders").doc(orderId);
    const proofRef = db.collection("tenants").doc(tenantId).collection("deliverySlipChecks").doc(orderId);
    await db.runTransaction(async tx => {
      const [snapshot, proofSnap] = await Promise.all([tx.get(orderRef), tx.get(proofRef)]);
      if (!snapshot.exists || !proofSnap.exists) return;
      const current = snapshot.data() || {};
      const proof = proofSnap.data() || {};
      if (proofValidForOrder(current, proof)) {
        // Claim is only issued by the server-side Slip2Go check, never the customer.
        tx.update(orderRef, {
          paymentStatus: "paid", paidAt: FieldValue.serverTimestamp(),
          slipCheckStatus: MATCHED,
          slipVerifiedAt: FieldValue.serverTimestamp(),
          slipVerificationProvider: "slip2go", slipVerificationStatus: MATCHED,
          paymentReviewRequired: false,
          kitchenReleasedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }
      if (current.paymentStatus === "pending_verification"
        && proof.status === "manual_review" && proofBoundToOrder(current, proof)) {
        tx.update(orderRef, {
          slipCheckStatus: "manual_review",
          slipVerificationProvider: clean(proof.provider || "slip2go"),
          slipVerificationStatus: "manual_review",
          paymentReviewRequired: true,
          paymentReviewReason: clean(proof.reason),
          paymentReviewPrimaryReason: clean(proof.primaryReason || ""),
          paymentReviewProviderCode: clean(proof.providerCode || "", 30),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
  },
);

exports.approveDeliveryPaymentReview = onCall(
  { region: REGION, timeoutSeconds: 30 },
  async request => {
    const tenantId = clean(request.data?.tenantId);
    const orderId = clean(request.data?.orderId);
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(tenantId)
      || !/^[A-Za-z0-9_-]{8,128}$/.test(orderId)) {
      throw new HttpsError("invalid-argument", "DELIVERY_ORDER_REQUIRED");
    }
    const actor = await superAdminReviewer(request.auth);
    const db = getFirestore();
    const orderRef = db.collection("tenants").doc(tenantId).collection("orders").doc(orderId);
    const proofRef = db.collection("tenants").doc(tenantId).collection("deliverySlipChecks").doc(orderId);
    const auditRef = db.collection("tenants").doc(tenantId).collection("deliverySlipManualReviewAudit").doc(orderId);
    let result = { alreadyPaid: false };
    await db.runTransaction(async tx => {
      const [orderSnap, proofSnap, auditSnap] = await Promise.all([
        tx.get(orderRef), tx.get(proofRef), tx.get(auditRef),
      ]);
      if (!orderSnap.exists)
        throw new HttpsError("not-found", "DELIVERY_ORDER_NOT_FOUND");
      const order = orderSnap.data() || {};
      if (order.paymentStatus === "paid") {
        result = { alreadyPaid: true };
        return;
      }
      const proof = proofSnap.data() || {};
      const technicalProof = proof.manualReviewEvidence;
      if (auditSnap.exists || !proofSnap.exists
        || order.orderType !== "delivery" || order.paymentMethod !== "promptpay"
        || order.paymentStatus !== "pending_verification"
        || order.paymentReviewRequired !== true
        || proof.status !== "manual_review" || proof.providerAttempted !== true
        || proof.manualReviewEligible !== true
        || !proofBoundToOrder(order, proof)
        || !allowManualReview({
          provider: "slip2go", status: "manual_review", proof: technicalProof,
        })) {
        throw new HttpsError("failed-precondition",
          "DELIVERY_MANUAL_REVIEW_NOT_ELIGIBLE");
      }
      tx.create(auditRef, {
        tenantId, orderId, kind: "slip2go_technical_fallback",
        reviewedBy: actor.uid, reviewerRole: "super_admin",
        reason: clean(technicalProof.reason), providerCode: clean(technicalProof.code, 30),
        amountCents: amountCents(order.totalAmount), reviewedAt: FieldValue.serverTimestamp(),
      });
      tx.update(orderRef, {
        paymentStatus: "paid", paidAt: FieldValue.serverTimestamp(),
        slipCheckStatus: "superadmin_approved",
        slipVerificationProvider: "superadmin_manual",
        slipVerificationStatus: "superadmin_technical_fallback",
        paymentReviewRequired: false,
        paymentReviewedByUid: actor.uid, paymentReviewedByEmail: actor.email,
        paymentReviewedByRole: "super_admin",
        paymentReviewedAt: FieldValue.serverTimestamp(),
        kitchenReleasedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { ok: true, tenantId, orderId, ...result };
  },
);

exports.listPlatformDeliveryManualReviews = onCall(
  { region: REGION, timeoutSeconds: 30 },
  async request => {
    const tenantId = clean(request.data?.tenantId);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(tenantId))
      throw new HttpsError("invalid-argument", "TENANT_ID_REQUIRED");
    await superAdminReviewer(request.auth);
    const tenantRef = getFirestore().collection("tenants").doc(tenantId);
    const tenant = await tenantRef.get();
    if (!tenant.exists) throw new HttpsError("not-found", "TENANT_NOT_FOUND");
    const pending = await tenantRef.collection("orders")
      .where("paymentReviewRequired", "==", true).limit(51).get();
    const rows = pending.docs.slice(0, 50);
    const result = await Promise.all(rows.map(async doc => {
      const order = doc.data() || {};
      const check = await tenantRef.collection("deliverySlipChecks").doc(doc.id).get();
      const proof = check.data() || {};
      const eligible = order.paymentStatus === "pending_verification"
        && order.orderType === "delivery" && order.paymentMethod === "promptpay"
        && proof.manualReviewEligible === true && proof.providerAttempted === true
        && proof.status === "manual_review"
        && proofBoundToOrder(order, proof)
        && allowManualReview({
          provider: "slip2go", status: "manual_review",
          proof: proof.manualReviewEvidence,
        });
      const path = String(proof.slipPath || "");
      return {
        id: doc.id,
        status: String(order.paymentStatus || "unknown").slice(0, 60),
        amountCents: Number.isSafeInteger(amountCents(order.totalAmount))
          && amountCents(order.totalAmount) >= 0
          ? amountCents(order.totalAmount) : null,
        eligible, reason: clean(eligible ? proof.manualReviewEvidence.reason
          : proof.reason || "technical_slip_proof_unverified"),
        providerCode: clean(eligible ? proof.manualReviewEvidence.code
          : proof.providerCode, 30),
        slipPath: eligible && path.startsWith(`tenants/${tenantId}/payment-slips/${doc.id}/`)
          ? path : "",
      };
    }));
    return { ok: true, tenantId,
      source: "server_delivery_slip_proof_and_order",
      requiresSuperAdmin: true, paymentAuthority: false,
      truncated: pending.size > rows.length, items: result };
  },
);

// Cashiers get alerts at order creation; kitchen alerts only when admitted.
exports.notifyKitchenDeliveryAdmitted = onDocumentWritten(
  { document: "tenants/{tenantId}/orders/{orderId}", region: REGION },
  async event => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!kitchenAdmitted(after) || kitchenAdmitted(before)) return;
    const { tenantId, orderId } = event.params;
    const db = getFirestore();
    const snapshot = await db.collection("tenants").doc(tenantId)
      .collection("notificationTokens").where("active", "==", true).get();
    const docs = snapshot.docs.filter(doc => ["owner", "admin", "kitchen"].includes(doc.data().role));
    const tokens = docs.map(doc => doc.data().token).filter(Boolean).slice(0, 500);
    if (!tokens.length) return;
    await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "มีออเดอร์ Delivery เข้าครัว",
        body: clean(after.recipientName || "ลูกค้า") + " • " + Number(after.totalAmount || 0).toFixed(2) + " บาท",
      },
      data: { type: "delivery_kitchen_admitted", tenantId, orderId },
      webpush: {
        fcmOptions: { link: "/kitchen/?order=" + encodeURIComponent(orderId) },
        notification: { icon: "/assets/images/icon-192.png", badge: "/assets/images/icon-192.png", tag: "kitchen-delivery-" + orderId, renotify: true },
      },
    });
  },
);
