const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { createHash } = require("node:crypto");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getMessaging } = require("firebase-admin/messaging");
const { inspectSlip } = require("./slip-verification");
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
    const manualProof = async reason => {
      await proofRef.set({
        tenantId, orderId, slipPath, amountCents: amountCents(amount),
        foodCents, feeCents, itemsSignature,
        status: "manual_review", provider: "slip2go", reason,
        checkedAt: FieldValue.serverTimestamp(), transRef: "",
      });
      return { status: "manual_review", reason, verification: "cashier", proofId: orderId };
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
    const [buffer] = await bucketFile.download();
    const receiverOverride = { accountType: receiverType, accountNumber: account };
    const result = await inspectSlip(buffer, mime, slipPath.split("/").pop(), amount, {
      providerOverride: "slip2go", receiverOverride,
    });
    const status = slipDecision(result);
    if (["duplicate", "mismatch", "invalid", "receiver_mismatch"].includes(status)) {
      return { status, reason: clean(result.reason) };
    }
    const transRef = clean(result.transRef || result.referenceId, 200);
    const finalStatus = status === MATCHED ? MATCHED : "manual_review";
    const proofData = {
      tenantId, orderId, slipPath, amountCents: amountCents(amount),
      foodCents, feeCents, itemsSignature,
      status: finalStatus, provider: clean(result.provider),
      reason: clean(result.reason),
      checkedAt: FieldValue.serverTimestamp(), transRef,
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
    return { status: finalStatus, reason: clean(result.reason), verification: finalStatus === MATCHED ? "slip2go" : "cashier", proofId: orderId };
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
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(tenantId) || !/^[A-Za-z0-9_-]{8,128}$/.test(orderId)) {
      throw new HttpsError("invalid-argument", "DELIVERY_ORDER_REQUIRED");
    }
    const actor = await cashierProfile(request.auth, tenantId);
    const db = getFirestore();
    const orderRef = db.collection("tenants").doc(tenantId).collection("orders").doc(orderId);
    const proofRef = db.collection("tenants").doc(tenantId).collection("deliverySlipChecks").doc(orderId);
    let result = { alreadyPaid: false };
    await db.runTransaction(async tx => {
      const [orderSnap, proofSnap] = await Promise.all([tx.get(orderRef), tx.get(proofRef)]);
      if (!orderSnap.exists) throw new HttpsError("not-found", "DELIVERY_ORDER_NOT_FOUND");
      const order = orderSnap.data() || {};
      if (order.paymentStatus === "paid") {
        result = { alreadyPaid: true };
        return;
      }
      const proof = proofSnap.data() || {};
      const created = order.createdAt?.toMillis?.() || Date.parse(String(order.createdAtText || "")) || 0;
      const legacySlip = !proofSnap.exists && created > 0
        && created < Date.parse("2026-10-08T00:00:00+07:00")
        && Boolean(clean(order.paymentSlipPath || order.paymentSlipUrl, 500))
        && Number(order.totalAmount) > 0;
      if (order.orderType !== "delivery" || order.paymentMethod !== "promptpay"
        || order.paymentStatus !== "pending_verification"
        || !(legacySlip || (order.paymentReviewRequired === true
          && proof.status === "manual_review" && proofBoundToOrder(order, proof)))) {
        throw new HttpsError("failed-precondition", "DELIVERY_MANUAL_REVIEW_NOT_ALLOWED");
      }
      tx.update(orderRef, {
        paymentStatus: "paid",
        paidAt: FieldValue.serverTimestamp(),
        slipCheckStatus: "cashier_approved",
        slipVerificationProvider: "cashier_manual",
        slipVerificationStatus: legacySlip ? "legacy_cashier_approved" : "cashier_approved",
        paymentReviewRequired: false,
        paymentReviewedByUid: actor.uid,
        paymentReviewedByEmail: actor.email,
        paymentReviewedByRole: actor.role,
        paymentReviewedAt: FieldValue.serverTimestamp(),
        kitchenReleasedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { ok: true, tenantId, orderId, ...result };
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
