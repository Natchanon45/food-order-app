const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const DEFAULT_TENANT_ID = "ff897699-de82-4370-a360-35b22cc74c85";
const STAFF_ROLES = new Set(["admin", "cashier", "kitchen", "super_admin"]);

function membershipPayload(uid, user = {}) {
  return {
    uid,
    email: user.email || "",
    displayName: user.displayName || "",
    role: user.role || "",
    active: user.active !== false,
    tenantId: DEFAULT_TENANT_ID,
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function assertSuperAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const userSnapshot = await getFirestore().collection("users").doc(auth.uid).get();
  const profile = userSnapshot.data();
  if (!profile || profile.active === false || profile.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Super admin permission required");
  }
}

exports.healthCheck = onCall(() => ({
  ok: true,
  service: "food-order-functions"
}));

exports.syncTenantMembership = onDocumentWritten(
  {
    document: "users/{uid}",
    region: "asia-southeast1"
  },
  async event => {
    const { uid } = event.params;
    const after = event.data?.after;
    const membershipRef = getFirestore()
      .collection("tenants")
      .doc(DEFAULT_TENANT_ID)
      .collection("memberships")
      .doc(uid);

    if (!after?.exists) {
      await membershipRef.delete().catch(error => {
        if (error.code !== 5) throw error;
      });
      return;
    }

    const user = after.data();
    if (!STAFF_ROLES.has(user.role)) {
      await membershipRef.delete().catch(error => {
        if (error.code !== 5) throw error;
      });
      return;
    }

    await membershipRef.set({
      ...membershipPayload(uid, user),
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
);

exports.backfillTenantMemberships = onCall(
  { region: "asia-southeast1" },
  async request => {
    await assertSuperAdmin(request.auth);

    const tenantId = String(request.data?.tenantId || DEFAULT_TENANT_ID).trim();
    if (tenantId !== DEFAULT_TENANT_ID) {
      throw new HttpsError("invalid-argument", "Unknown tenant");
    }

    const db = getFirestore();
    const usersSnapshot = await db.collection("users").get();
    const batch = db.batch();
    let count = 0;

    usersSnapshot.docs.forEach(userDoc => {
      const user = userDoc.data();
      if (!STAFF_ROLES.has(user.role)) return;
      const membershipRef = db
        .collection("tenants")
        .doc(tenantId)
        .collection("memberships")
        .doc(userDoc.id);
      batch.set(membershipRef, {
        ...membershipPayload(userDoc.id, user),
        tenantId,
        createdAt: FieldValue.serverTimestamp()
      }, { merge: true });
      count += 1;
    });

    if (count) await batch.commit();
    return { ok: true, tenantId, membershipsCreated: count };
  }
);

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
