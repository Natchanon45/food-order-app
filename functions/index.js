const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const DEFAULT_TENANT = Object.freeze({
  id: "ff897699-de82-4370-a360-35b22cc74c85",
  slug: "tuahere-somtam",
  name: "ส้มตำตัวเฮีย"
});
const STAFF_ROLES = new Set(["admin", "cashier", "kitchen", "super_admin"]);

function tenantFromUser(user = {}) {
  return {
    id: String(user.tenantId || DEFAULT_TENANT.id).trim(),
    slug: String(user.tenantSlug || DEFAULT_TENANT.slug).trim().toLowerCase(),
    name: String(user.tenantName || DEFAULT_TENANT.name).trim()
  };
}

function membershipPayload(uid, user = {}, tenant = tenantFromUser(user)) {
  return {
    uid,
    email: user.email || "",
    displayName: user.displayName || "",
    role: user.role || "",
    active: user.active !== false,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function deleteMembership(db, tenantId, uid) {
  if (!tenantId) return;
  await db.collection("tenants").doc(tenantId).collection("memberships").doc(uid).delete().catch(error => {
    if (error.code !== 5) throw error;
  });
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
    const before = event.data?.before;
    const after = event.data?.after;
    const db = getFirestore();
    const beforeUser = before?.exists ? before.data() : null;
    const afterUser = after?.exists ? after.data() : null;
    const beforeTenant = beforeUser ? tenantFromUser(beforeUser) : null;
    const afterTenant = afterUser ? tenantFromUser(afterUser) : null;

    if (!afterUser || !STAFF_ROLES.has(afterUser.role)) {
      await deleteMembership(db, beforeTenant?.id, uid);
      return;
    }

    if (beforeTenant?.id && beforeTenant.id !== afterTenant.id) {
      await deleteMembership(db, beforeTenant.id, uid);
    }

    await db
      .collection("tenants")
      .doc(afterTenant.id)
      .collection("memberships")
      .doc(uid)
      .set({
        ...membershipPayload(uid, afterUser, afterTenant),
        createdAt: FieldValue.serverTimestamp()
      }, { merge: true });
  }
);

exports.backfillTenantMemberships = onCall(
  { region: "asia-southeast1" },
  async request => {
    await assertSuperAdmin(request.auth);

    const tenantId = String(request.data?.tenantId || DEFAULT_TENANT.id).trim();
    if (tenantId !== DEFAULT_TENANT.id) {
      throw new HttpsError("invalid-argument", "Unknown tenant");
    }

    const db = getFirestore();
    const usersSnapshot = await db.collection("users").get();
    const batch = db.batch();
    let membershipsCreated = 0;
    let userProfilesUpdated = 0;

    usersSnapshot.docs.forEach(userDoc => {
      const user = userDoc.data();
      if (!STAFF_ROLES.has(user.role)) return;

      const tenant = tenantFromUser(user);
      const userPatch = {};
      if (!user.tenantId) userPatch.tenantId = tenant.id;
      if (!user.tenantSlug) userPatch.tenantSlug = tenant.slug;
      if (!user.tenantName) userPatch.tenantName = tenant.name;

      if (Object.keys(userPatch).length) {
        userPatch.updatedAt = FieldValue.serverTimestamp();
        batch.set(userDoc.ref, userPatch, { merge: true });
        userProfilesUpdated += 1;
      }

      const membershipRef = db
        .collection("tenants")
        .doc(tenant.id)
        .collection("memberships")
        .doc(userDoc.id);
      batch.set(membershipRef, {
        ...membershipPayload(userDoc.id, user, tenant),
        createdAt: FieldValue.serverTimestamp()
      }, { merge: true });
      membershipsCreated += 1;
    });

    if (membershipsCreated || userProfilesUpdated) await batch.commit();
    return {
      ok: true,
      tenantId,
      membershipsCreated,
      userProfilesUpdated
    };
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

const tenantAdmin = require("./tenant-admin");
exports.listTenants = tenantAdmin.listTenants;
exports.createTenant = tenantAdmin.createTenant;
