"use strict";
// Source-only protection for Super Admin tenant profile / slug metadata.
// Suspended/migrating Hybrid cannot have a stale active slug re-enabled.
const { legacyDeliveryPaidWriterAllowed } =
  require("./hybrid-billing-legacy-payment-guard");
async function updateTenantMetadataTransaction({
  db, tenantRef, tenantId, slug, name, phone, address, requestedBusinessType,
  businessUnitsFor, usersSnapshot, serverTimestamp,
} = {}) {
  if (!db || typeof db.runTransaction !== "function" || !tenantRef
    || !tenantId || !slug || !name || typeof serverTimestamp !== "function"
    || typeof businessUnitsFor !== "function"
    || !Array.isArray(usersSnapshot?.docs))
    throw Error("HYBRID_TENANT_PROFILE_BAD_REQUEST");
  return db.runTransaction(async tx => {
    // Read Tenant and BOTH slug records before scheduling ANY write.
    const snap = await tx.get(tenantRef);
    if (!snap.exists) throw Error("HYBRID_TENANT_PROFILE_NOT_FOUND");
    const current = snap.data();
    const oldSlug = String(current.slug || "").trim();
    const slugRef = db.collection("tenantSlugs").doc(slug);
    const newSlugSnap = await tx.get(slugRef);
    let oldSlugRef = null, oldSlugSnap = null;
    if (oldSlug && oldSlug !== slug) {
      oldSlugRef = db.collection("tenantSlugs").doc(oldSlug);
      oldSlugSnap = await tx.get(oldSlugRef);
    }
    if (newSlugSnap.exists && newSlugSnap.data().tenantId !== tenantId)
      throw Error("HYBRID_TENANT_PROFILE_SLUG_IN_USE");
    if (oldSlugSnap?.exists && oldSlugSnap.data().tenantId !== tenantId)
      throw Error("HYBRID_TENANT_PROFILE_OLD_SLUG_MISMATCH");
    const financial = !legacyDeliveryPaidWriterAllowed(current);
    // A partial journal-only Hybrid is not ready for reactivation through the
    // legacy slug/profile admin route. Respect finance manual holds as well.
    const slugActive = current.active !== false
      && (!financial || (current.billingPolicyVersion === "hybrid_v1"
        && current.hybridBillingEnabled === true
        && current.hybridBillingSuspended !== true
        && current.hybridBillingManualHold !== true));
    const masterBusinessChanged =
      requestedBusinessType !== undefined && requestedBusinessType !== current.businessType;
    const masterFields = masterBusinessChanged
      ? { businessType: requestedBusinessType,
        businessUnits: businessUnitsFor(requestedBusinessType) } : {};
    const now = serverTimestamp();
    tx.set(tenantRef, { ...masterFields, name, slug, updatedAt: now },
      { merge: true });
    tx.set(tenantRef.collection("settings").doc("store"), {
      shopName: name, shopPhone: phone, shopAddress: address, updatedAt: now,
    }, { merge: true });
    tx.set(slugRef, { tenantId, slug, name, active: slugActive,
      updatedAt: now }, { merge: true });
    if (oldSlugRef && oldSlugSnap?.exists) tx.delete(oldSlugRef);
    for (const userDoc of usersSnapshot.docs) {
      tx.set(userDoc.ref, {
        ...masterFields, tenantSlug: slug, tenantName: name, updatedAt: now,
      }, { merge: true });
      tx.set(tenantRef.collection("memberships").doc(userDoc.id), {
        tenantSlug: slug, tenantName: name, updatedAt: now,
      }, { merge: true });
    }
    return { tenantId, slug, name, active: current.active !== false,
      slugActive };
  });
}
// Creating Firebase Auth identity is NOT a Firestore transaction. Caller must
// roll back a newly created Auth identity if this admission fails. This
// authoritative transaction re-reads finance markers and active Owner presence.
async function createLegacyTenantOwnerTransaction({
  db, tenantRef, userRef, uid, email, displayName, serverTimestamp,
} = {}) {
  if (!db || typeof db.runTransaction !== "function" || !tenantRef
    || !userRef || !uid || !email || !displayName
    || typeof serverTimestamp !== "function")
    throw Error("HYBRID_OWNER_ENROLLMENT_INVALID_REQUEST");
  return db.runTransaction(async tx => {
    const tenantSnap = await tx.get(tenantRef);
    if (!tenantSnap.exists)
      throw Error("HYBRID_OWNER_ENROLLMENT_TENANT_NOT_FOUND");
    const tenant = tenantSnap.data();
    // Until Hybrid registration is formally released, no Owner enrollment
    // is permitted under any hybrid policy, partial migration or journal mark.
    if (!legacyDeliveryPaidWriterAllowed(tenant)
      || tenant.active === false
      || tenant.hybridBillingSuspended === true
      || tenant.hybridBillingManualHold === true)
      throw Error("HYBRID_OWNER_ENROLLMENT_NOT_ALLOWED");
    const owners = await tx.get(tenantRef.collection("memberships")
      .where("role", "==", "owner").where("active", "==", true).limit(1));
    if (!owners.empty)
      throw Error("HYBRID_OWNER_ENROLLMENT_OWNER_EXISTS");
    const old = await tx.get(userRef);
    if (old.exists)
      throw Error("HYBRID_OWNER_ENROLLMENT_UID_EXISTS");
    const now = serverTimestamp();
    const profile = {
      uid, email, displayName, role: "owner", active: true,
      tenantId: tenantRef.id,
      tenantSlug: tenant.slug || "", tenantName: tenant.name || "",
      createdAt: now, updatedAt: now,
    };
    tx.create(userRef, profile);
    tx.create(tenantRef.collection("memberships").doc(uid), profile);
    tx.set(tenantRef, {
      ownerUid: uid, ownerEmail: email, ownerDisplayName: displayName,
      updatedAt: now,
    }, { merge: true });
    return { tenantId: tenantRef.id, uid };
  });
}
module.exports = { updateTenantMetadataTransaction,
  createLegacyTenantOwnerTransaction };
