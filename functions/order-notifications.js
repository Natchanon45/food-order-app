const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered"
]);

exports.notifyNewTableOrder = onDocumentCreated(
  {
    document: "tenants/{tenantId}/orders/{orderId}",
    region: "asia-southeast1",
    retry: true
  },
  async event => {
    const snapshot = event.data;
    if (!snapshot) return;
    const order = snapshot.data();
    if (order.orderType === "delivery") return;

    const { tenantId, orderId } = event.params;
    const db = getFirestore();
    const tokenSnapshot = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("notificationTokens")
      .where("active", "==", true)
      .get();

    const tokenDocs = tokenSnapshot.docs.filter(doc =>
      ["owner", "admin", "kitchen"].includes(doc.data().role)
    );
    const tokens = tokenDocs.map(doc => doc.data().token).filter(Boolean);
    if (!tokens.length) return;

    const tableCode = order.tableCode || "-";
    const round = order.roundNumber || 1;
    const message = {
      tokens: tokens.slice(0, 500),
      notification: {
        title: "มีออเดอร์หน้าร้านใหม่",
        body: `โต๊ะ ${tableCode} • รอบที่ ${round}`
      },
      data: {
        type: "table_order_created",
        tenantId,
        orderId,
        url: `/kitchen/?order=${encodeURIComponent(orderId)}`
      },
      webpush: {
        fcmOptions: { link: `/kitchen/?order=${encodeURIComponent(orderId)}` },
        notification: {
          icon: "/assets/images/icon-192.png",
          badge: "/assets/images/icon-192.png",
          tag: `table-${orderId}`,
          renotify: true
        }
      }
    };

    const response = await getMessaging().sendEachForMulticast(message);
    const invalidWrites = [];
    response.responses.forEach((result, index) => {
      if (result.success || !INVALID_TOKEN_CODES.has(result.error?.code)) return;
      invalidWrites.push(tokenDocs[index].ref.set({
        active: false,
        invalidatedAt: FieldValue.serverTimestamp(),
        errorCode: result.error.code
      }, { merge: true }));
    });
    await Promise.all(invalidWrites);
  }
);
