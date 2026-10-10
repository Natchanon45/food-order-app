"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getDeliveryOpeningStatus } = require("./delivery-opening-hours");

const REGION = "asia-southeast1";
// Preserve the fields legitimately produced by the current Delivery checkout,
// while never accepting client supplied status, order-type, or audit metadata.
const ALLOWED_FIELDS = new Set([
  "id", "orderType", "status", "paymentStatus", "tableCode", "recipientName", "recipientPhone", "deliveryAddress",
  "deliveryProvider", "deliveryZone", "deliveryZoneLabel", "deliveryBaseFee",
  "deliveryFee", "deliveryFeeDiscount", "freeShippingApplied",
  "deliveryFeeMode", "freeGiftMenuIds", "freeGiftApplied", "freeGiftItems",
  "freeGiftMaxSelectableItems", "freeGiftValidFrom", "freeGiftValidUntil",
  "subtotalAmount", "totalAmount", "paymentMethod", "paymentSlipUrl",
  "paymentSlipPath", "slipCheckStatus", "paymentReviewRequired", "note",
  "items", "deliveryLatitude", "deliveryLongitude", "deliveryDistanceKm",
  "deliveryDistanceMeters", "deliveryDurationSeconds", "deliveryRouteProvider",
  "lalamoveQuotationId", "lalamoveQuotationExpiresAt", "lalamoveCurrency",
  "lalamoveAccountMode", "lalamoveAccountEnvironment", "lalamoveDispatchQuote",
  "lalamoveCodEnabled", "lalamoveCodAmount", "lalamoveDispatchFee",
  "lalamoveDispatchPriceDifference", "lalamoveDispatchRequiresApproval",
  "lalamoveDispatchQuotedAt",
]);

function validateSubmission(data) {
  const tenantId = typeof data?.tenantId === "string" ? data.tenantId.trim() : "";
  const order = data?.order;
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(tenantId)
    || !order || typeof order !== "object" || Array.isArray(order)) {
    throw new HttpsError("invalid-argument", "DELIVERY_ORDER_INVALID");
  }
  if (JSON.stringify(order).length > 50000) {
    throw new HttpsError("invalid-argument", "DELIVERY_ORDER_TOO_LARGE");
  }
  if (Object.keys(order).some(key => !ALLOWED_FIELDS.has(key))) {
    throw new HttpsError("invalid-argument", "DELIVERY_ORDER_INVALID_FIELDS");
  }
  const id = typeof order.id === "string" ? order.id.trim() : "";
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)
    || (order.orderType != null && order.orderType !== "delivery")
    || !["cod", "promptpay"].includes(order.paymentMethod)
    || !["self", "lalamove"].includes(order.deliveryProvider)
    || !Array.isArray(order.items) || order.items.length < 1 || order.items.length > 100
    || order.items.some(item => !item || typeof item !== "object" ||
      typeof item.name !== "string" || !Number.isFinite(item.price) || item.price < 0 ||
      !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 100)
    || !Number.isFinite(order.totalAmount) || order.totalAmount < 0
    || !Number.isFinite(order.subtotalAmount) || order.subtotalAmount < 0
    || typeof order.recipientName !== "string" || !order.recipientName.trim()
    || typeof order.recipientPhone !== "string" || !order.recipientPhone.trim()
    || typeof order.deliveryAddress !== "string" || !order.deliveryAddress.trim()
    || !Number.isFinite(order.deliveryLatitude) || Math.abs(order.deliveryLatitude) > 90
    || !Number.isFinite(order.deliveryLongitude) || Math.abs(order.deliveryLongitude) > 180
    || (order.deliveryLatitude === 0 && order.deliveryLongitude === 0)
    || (order.paymentMethod === "promptpay" && (
      !["matched", "manual_review"].includes(order.slipCheckStatus)
      || !order.paymentSlipPath || typeof order.paymentSlipPath !== "string"
      || !order.paymentSlipPath.startsWith("tenants/" + tenantId + "/payment-slips/" + id + "/")
    ))) {
    throw new HttpsError("invalid-argument", "DELIVERY_ORDER_INVALID");
  }
  return { tenantId, id, order };
}

async function createDeliveryOrderWithGuard(db, tenantId, id, order) {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const settingsRef = tenantRef.collection("settings").doc("store");
  const orderRef = tenantRef.collection("orders").doc(id);
  return db.runTransaction(async transaction => {
    // Every transaction attempt re-reads store hours; a concurrent admin close
    // causes Firestore to retry and refuse the pending create.
    const [tenantSnap, settingsSnap, existingOrder] = await Promise.all([
      transaction.get(tenantRef), transaction.get(settingsRef), transaction.get(orderRef),
    ]);
    if (!tenantSnap.exists || !settingsSnap.exists) {
      throw new HttpsError("not-found", "DELIVERY_STORE_STATUS_UNAVAILABLE");
    }
    const type = String(tenantSnap.data()?.businessType || "both");
    if (!["both", "restaurant_cafe"].includes(type)) {
      throw new HttpsError("permission-denied", "DELIVERY_BUSINESS_DISABLED");
    }
    const store = settingsSnap.data() || {};
    // Both payment options default to their legacy enabled state until a shop opts out.
    if (order.paymentMethod === "cod" && store.deliveryCodEnabled === false) {
      throw new HttpsError("failed-precondition", "DELIVERY_COD_DISABLED");
    }
    if (order.paymentMethod === "promptpay" && store.deliveryPromptPayEnabled === false) {
      throw new HttpsError("failed-precondition", "DELIVERY_PROMPTPAY_DISABLED");
    }
    if (!getDeliveryOpeningStatus(store, new Date()).open) {
      throw new HttpsError("failed-precondition", "DELIVERY_STORE_CLOSED");
    }
    if (existingOrder.exists) {
      throw new HttpsError("already-exists", "DELIVERY_ORDER_ALREADY_EXISTS");
    }
    const safeOrder = Object.fromEntries(
      Object.entries(order).filter(([key]) => ALLOWED_FIELDS.has(key))
    );
    // No privileged payment statuses or audit fields can be supplied by public clients.
    delete safeOrder.slipVerificationStatus;
    delete safeOrder.paymentStatus;
    delete safeOrder.status;
    transaction.create(orderRef, {
      ...safeOrder,
      id, tenantId, shopId: tenantId, orderType: "delivery",
      tableCode: "DELIVERY", tableToken: "", tableName: "",
      status: "pending",
      paymentStatus: order.paymentMethod === "promptpay" ? "pending_verification" : "unpaid",
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return { id };
  });
}

exports.submitPublicDeliveryOrder = onCall(
  { region: REGION, timeoutSeconds: 35, memory: "256MiB" },
  async request => {
    const { tenantId, id, order } = validateSubmission(request.data);
    return createDeliveryOrderWithGuard(getFirestore(), tenantId, id, order);
  }
);

// Export pure helpers for regression tests without touching a live tenant.
exports.__test = { validateSubmission, createDeliveryOrderWithGuard, ALLOWED_FIELDS };
