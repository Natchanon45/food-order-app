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
const STAFF_ROLES = new Set(["owner", "admin", "cashier", "kitchen", "super_admin"]);

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
    console.warn("Membership cleanup failed", { tenantId, uid, error: error.message });
  });
}

exports.syncUserMembership = onDocumentWritten(
  { document: "users/{uid}", region: "asia-southeast1" },
  async event => {
    const db = getFirestore();
    const uid = event.params.uid;
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    if (before?.tenantId && before.tenantId !== after?.tenantId) {
      await deleteMembership(db, before.tenantId, uid);
    }

    if (!after) {
      if (before?.tenantId) await deleteMembership(db, before.tenantId, uid);
      return;
    }

    if (!STAFF_ROLES.has(after.role)) {
      if (after.tenantId) await deleteMembership(db, after.tenantId, uid);
      return;
    }

    const tenant = tenantFromUser(after);
    await db.collection("tenants").doc(tenant.id).collection("memberships").doc(uid).set(
      membershipPayload(uid, after, tenant),
      { merge: true }
    );
  }
);

exports.migrateCurrentUsersToSaaS = onCall(
  { region: "asia-southeast1" },
  async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");

    const db = getFirestore();
    const callerSnapshot = await db.collection("users").doc(request.auth.uid).get();
    const caller = callerSnapshot.data();
    if (!caller || caller.active === false || caller.role !== "super_admin") {
      throw new HttpsError("permission-denied", "Super admin permission required");
    }

    const usersSnapshot = await db.collection("users").get();
    const batch = db.batch();
    let migrated = 0;

    usersSnapshot.docs.forEach(userDoc => {
      const user = userDoc.data();
      if (user.role === "super_admin") return;
      const tenant = tenantFromUser(user);
      batch.set(userDoc.ref, {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      batch.set(db.collection("tenants").doc(tenant.id).collection("memberships").doc(userDoc.id), membershipPayload(userDoc.id, user, tenant), { merge: true });
      migrated += 1;
    });

    await batch.commit();
    return { ok: true, migrated };
  }
);

exports.notifyDeliveryOrderCreated = onDocumentCreated(
  { document: "tenants/{tenantId}/orders/{orderId}", region: "asia-southeast1" },
  async event => {
    const order = event.data?.data();
    if (!order || order.orderType !== "delivery") return;

    const { tenantId, orderId } = event.params;
    const db = getFirestore();
    const tokenSnapshot = await db.collection("tenants").doc(tenantId).collection("notificationTokens")
      .where("active", "==", true)
      .where("role", "in", ["owner", "cashier"])
      .get();

    const tokenDocs = tokenSnapshot.docs;
    const tokens = tokenDocs.map(doc => doc.data().token).filter(Boolean);
    if (!tokens.length) return;

    const message = {
      tokens,
      notification: {
        title: "มีออเดอร์ Delivery ใหม่",
        body: `${order.recipientName || "ลูกค้า"} • ${Number(order.totalAmount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`
      },
      data: {
        type: "delivery_order",
        tenantId,
        orderId
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
exports.createTenantOwner = tenantAdmin.createTenantOwner;
exports.updateTenantOwner = tenantAdmin.updateTenantOwner;
exports.updateTenant = tenantAdmin.updateTenant;
exports.deleteTenant = tenantAdmin.deleteTenant;

const staffAdmin = require("./staff-admin");
exports.listTenantStaff = staffAdmin.listTenantStaff;
exports.createTenantStaff = staffAdmin.createTenantStaff;
exports.updateTenantStaff = staffAdmin.updateTenantStaff;
