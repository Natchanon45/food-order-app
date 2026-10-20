"use strict";

// Phase 3J candidate ONLY. Not exported from functions/index.js.
// Firebase onCall verifies request.auth before passing authenticated uid here.
// Do not register/ship until Rules and customer-side write guards pass UAT.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { settleHybridCodDeliveryPayment } = require("./hybrid-billing-cod-payment");

const ID = /^[A-Za-z0-9_-]{8,128}$/;
const ALLOWED_KEYS = new Set(["tenantId", "orderId"]);
const fail = (code, message) => { throw new HttpsError(code, message); };

function makeHybridCodCallableHandler({
  getDb = getFirestore, settle = settleHybridCodDeliveryPayment,
} = {}) {
  if (typeof getDb !== "function" || typeof settle !== "function") {
    throw Error("HYBRID_COD_CALLABLE_BAD_DEPENDENCIES");
  }
  return async function handleHybridCodCashierPayment(request) {
    // uid is supplied ONLY by a verified callable auth context.
    const uid = request?.auth?.uid;
    if (typeof uid !== "string" || !ID.test(uid)) {
      fail("unauthenticated", "HYBRID_COD_AUTH_REQUIRED");
    }
    const input = request?.data;
    if (!input || typeof input !== "object" || Array.isArray(input)
      || Object.keys(input).some(key => !ALLOWED_KEYS.has(key))
      || Object.keys(input).length !== 2
      || typeof input.tenantId !== "string"
      || typeof input.orderId !== "string"
      || !ID.test(input.tenantId) || !ID.test(input.orderId)) {
      // Reject price, actor, dates, status, or bank fields: no caller-supplied
      // financial data may influence the server transaction.
      fail("invalid-argument", "HYBRID_COD_ALLOWED_FIELDS_TENANT_AND_ORDER_ONLY");
    }
    try {
      return await settle({
        db: getDb(), tenantId: input.tenantId,
        orderId: input.orderId, actorUid: uid,
      });
    } catch (error) {
      const code = String(error?.message || "");
      if (code === "HYBRID_COD_CASHIER_NOT_AUTHORIZED") {
        fail("permission-denied", code);
      }
      if (code === "HYBRID_COD_ORDER_NOT_FOUND") {
        fail("not-found", code);
      }
      if ([
        "HYBRID_COD_TENANT_NOT_ENABLED",
        "HYBRID_COD_ORDER_NOT_ELIGIBLE",
        "HYBRID_COD_DELIVERY_NOT_COMPLETED",
        "HYBRID_COD_EXISTING_PAYMENT_REQUIRES_RECONCILIATION",
        "HYBRID_COD_PAYMENT_STATUS_CONFLICT",
      ].includes(code)) {
        fail("failed-precondition", code);
      }
      if (code === "HYBRID_COD_INVALID_REQUEST") {
        fail("invalid-argument", code);
      }
      // Unexpected Firestore errors and schema states must not leak sensitive
      // invoice/order details through a client-facing callable.
      fail("internal", "HYBRID_COD_INTERNAL_ERROR");
    }
  };
}

// This function is internal to this file; it is NOT deployed until explicitly
// re-exported from functions/index.js after security/staging review.
const hybridCodCashierPaymentCandidate = onCall(
  { region: "asia-southeast1", timeoutSeconds: 30, enforceAppCheck: true },
  makeHybridCodCallableHandler(),
);

module.exports = {
  makeHybridCodCallableHandler,
  hybridCodCashierPaymentCandidate,
};
