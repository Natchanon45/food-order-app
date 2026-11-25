"use strict";

const { onCall, HttpsError } = require("./managed-email-callable");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { randomBytes, createHash } = require("node:crypto");
const qr = require("./payment-companion-qr-policy");
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
  "paymentSlipPath", "slipCheckStatus", "paymentReviewRequired", "paymentQrMode", "note",
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
    || (order.paymentMethod === "promptpay" && order.paymentQrMode !== "confirmed_order_5m" && (
      !["matched", "manual_review"].includes(order.slipCheckStatus)
      || !order.paymentSlipPath || typeof order.paymentSlipPath !== "string"
      || !order.paymentSlipPath.startsWith("tenants/" + tenantId + "/payment-slips/" + id + "/")
    ))) {
    throw new HttpsError("invalid-argument", "DELIVERY_ORDER_INVALID");
  }
  if(order.paymentQrMode != null && (order.paymentQrMode !== "confirmed_order_5m"
    || order.paymentMethod !== "promptpay" || order.deliveryProvider !== "lalamove"
    || order.paymentSlipPath || order.slipCheckStatus || order.paymentReviewRequired === true)) {
    throw new HttpsError("invalid-argument", "DELIVERY_QR_ORDER_INVALID");
  }
  return { tenantId, id, order };
}

async function createDeliveryOrderWithGuard(db, tenantId, id, order) {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const settingsRef = tenantRef.collection("settings").doc("store");
  const orderRef = tenantRef.collection("orders").doc(id);
  const wantsQr=order.paymentQrMode==="confirmed_order_5m";
  if(wantsQr&&(!qr.ID.test(String(order.lalamoveQuotationId||""))||
    !Array.isArray(order.items)||order.items.length>60||
    order.items.some(item=>!qr.ID.test(String(item.menuId||""))))){
    throw new HttpsError("invalid-argument","DELIVERY_QR_QUOTE_OR_CART_INVALID");
  }
  // Creation token never gets persisted; clients only ever see its digest.
  const capability=wantsQr?randomBytes(32).toString("hex"):"";
  const capabilityHash=wantsQr?createHash("sha256").update(capability).digest("hex"):"";
  return db.runTransaction(async transaction => {
    // Every transaction attempt re-reads store hours; a concurrent admin close
    // causes Firestore to retry and refuse the pending create.
    const extra=wantsQr?[
      transaction.get(tenantRef.collection("deliveryCheckoutQuotes").doc(String(order.lalamoveQuotationId||""))),
      transaction.get(getFirestore().collection("paymentCompanionTenants").doc(tenantId)),
      ...order.items.filter(item=>!item.isGift).map(item=>transaction.get(tenantRef.collection("menus").doc(String(item.menuId||"")))),
    ]:[];
    const [tenantSnap, settingsSnap, existingOrder,...details] = await Promise.all([
      transaction.get(tenantRef), transaction.get(settingsRef), transaction.get(orderRef),...extra,
    ]);
    if (!tenantSnap.exists || !settingsSnap.exists) {
      throw new HttpsError("not-found", "DELIVERY_STORE_STATUS_UNAVAILABLE");
    }
    const tenantData=tenantSnap.data()||{};
    if(tenantData.active===false||tenantData.operationalSuspended===true||
      tenantData.revenueShareSuspended===true||
      ["expired","suspended"].includes(String(tenantData.subscriptionStatus||"").toLowerCase())||
      String(tenantData.status||"").toLowerCase()==="suspended")
      throw new HttpsError("failed-precondition","M7_PUBLIC_STOREFRONT_SUSPENDED");
    const type = String(tenantSnap.data()?.businessType || "both");
    if (!["both", "restaurant_cafe"].includes(type)) {
      throw new HttpsError("permission-denied", "DELIVERY_BUSINESS_DISABLED");
    }
    const store = settingsSnap.data() || {};
    // Global operational policy: COD remains suspended until the store wallet
    // and bank reconciliation are independently approved. A per-store flag is
    // NOT authorization to start collecting cash via an external driver.
    if(order.paymentMethod === "cod") {
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
    let authoritativeQr=null;
    if(wantsQr){
      if(qr.configuredTenant()!==tenantId||tenantSnap.data()?.active!==true)
        throw new HttpsError("failed-precondition","DELIVERY_QR_PILOT_DISABLED");
      const [quote,link,...menuDocs]=details;
      const now=Date.now();
      try{
        const binding=qr.receiverReady(settingsSnap,link.data()?.receiver,tenantId,now);
        const food=qr.verifyCatalog(order.items,menuDocs,order);
        qr.verifyQuotation({...order,tenantId},quote,food,now);
        authoritativeQr={
          paymentQrMode:"confirmed_order_5m",paymentQrStartedAtUTC:new Date(now).toISOString(),
          paymentQrExpiresAtUTC:new Date(now+qr.QR_DURATION_MS).toISOString(),
          paymentQrReceiverRevision:binding.revision,
          promptPayQRRecipientId:binding.payee,
          promptPayQRRecipientName:String(settingsSnap.data()?.promptPayName||settingsSnap.data()?.shopName||"").trim().slice(0,100),
          paymentQrCapabilityDigest:capabilityHash,
          paymentQrSlipFallbackStatus:"not_required",
        };
      }catch(err){throw new HttpsError("failed-precondition",String(err.message||"DELIVERY_QR_UNCONFIRMED"));}
    }
    const safeOrder = Object.fromEntries(
      Object.entries(order).filter(([key]) => ALLOWED_FIELDS.has(key))
    );
    // No privileged payment statuses or audit fields can be supplied by public clients.
    delete safeOrder.paymentQrMode;
    delete safeOrder.slipVerificationStatus;
    delete safeOrder.paymentStatus;
    delete safeOrder.status;
    transaction.create(orderRef, {
      ...safeOrder,
      id, tenantId, shopId: tenantId, orderType: "delivery",
      tableCode: "DELIVERY", tableToken: "", tableName: "",
      status: "pending",
      ...(authoritativeQr||{}),
      ...(authoritativeQr?{slipCheckStatus:"",paymentReviewRequired:false,paymentSlipPath:""}:{}),
      paymentStatus: order.paymentMethod === "promptpay" ? "pending_verification" : "unpaid",
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return { id, ...(authoritativeQr?{paymentQrMode:"confirmed_order_5m",paymentCorrectionCapability:capability}:{} ) };
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
