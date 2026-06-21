const { onCall } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

exports.healthCheck = onCall(() => ({
  ok: true,
  service: "food-order-functions"
}));

exports.notifyNewDeliveryOrder = onDocumentCreated(
  {
    document: "tenants/{tenantId}/orders/{orderId}",
    region: "asia-southeast1",
    retry: true
  },
  async event => {
    const snapshot = event.data;
    if (!snapshot) return;

    const order = snapshot.data();
    if (order.orderType !== "delivery") return;

    const { tenantId, orderId } = event.params;
    const db = getFirestore();
    const tokenSnapshot = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("notificationTokens")
      .where("active", "==", true)
      .get();

    const tokenDocs = tokenSnapshot.docs.filter(doc => {
      const role = doc.data().role;
      return ["owner", "admin", "cashier", "kitchen", "super_admin"].includes(role);
    });

    const tokens = tokenDocs.map(doc => doc.data().token).filter(Boolean);
    if (!tokens.length) {
      console.log("No active FCM tokens", { tenantId, orderId });
      return;
    }

    const recipient = order.recipientName || "ลูกค้า";
    const total = Number(order.totalAmount || 0).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const message = {
      tokens: tokens.slice(0, 500),
      notification: {
        title: "มีออเดอร์ Delivery ใหม่",
        body: `${recipient} • ยอด ${total} บาท`
      },
      data: {
        type: "delivery_order_created",
        tenantId,
        orderId,
        url: `/cashier/?order=${encodeURIComponent(orderId)}`
      },
      webpush: {
        fcmOptions: {
          link: `/cashier/?order=${encodeURIComponent(orderId)}`
        },
        notification: {
          icon: "/assets/images/icon-192.png",
          badge: "/assets/images/icon-192.png",
          tag: `delivery-${orderId}`,
          renotify: true
        }
      }
    };

    const response = await getMessaging().sendEachForMulticast(message);
    console.log("Delivery push result", {
      tenantId,
      orderId,
      successCount: response.successCount,
      failureCount: response.failureCount
    });

    const invalidCodes = new Set([
      "messaging/invalid-registration-token",
      "messaging/registration-token-not-registered"
    ]);
    const invalidWrites = [];

    response.responses.forEach((result, index) => {
      if (result.success || !invalidCodes.has(result.error?.code)) return;
      invalidWrites.push(tokenDocs[index].ref.set({
        active: false,
        invalidatedAt: FieldValue.serverTimestamp(),
        errorCode: result.error.code
      }, { merge: true }));
    });

    await Promise.all(invalidWrites);
  }
);
