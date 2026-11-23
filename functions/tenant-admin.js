const { HttpsError, onCall } = require("./managed-email-callable");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { onboardingDates } = require("./tenant-onboarding-policy");
const { readTenantFinanceEvidence } = require("./tenant-finance-source-evidence");
const { getAuth } = require("firebase-admin/auth");
const { randomUUID } = require("crypto");
// Legacy master edits are routed to the transactional P1.2f engine.
const tenantMasterEdit = require("./tenant-master-edit");
const tenantSafeDeletion = require("./tenant-safe-deletion");

function normalizeSlug(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function validateTenant(name, slug) {
  if (name.length < 2 || name.length > 120) {
    throw new HttpsError("invalid-argument", "Tenant name must contain 2-120 characters");
  }
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
    throw new HttpsError("invalid-argument", "Slug must contain 3-50 lowercase letters, numbers, or hyphens");
  }
}

async function assertSuperAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const profileSnapshot = await getFirestore().collection("users").doc(auth.uid).get();
  const profile = profileSnapshot.data();
  if (!profile || profile.active === false || profile.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Super admin permission required");
  }
  return profile;
}

exports.listTenants = onCall(
  { region: "asia-southeast1" },
  async request => {
    await assertSuperAdmin(request.auth);
    const snapshot = await getFirestore().collection("tenants").orderBy("name").get();
    const tenants = await Promise.all(snapshot.docs.map(async tenantDoc => {
      const tenant = { id: tenantDoc.id, ...tenantDoc.data() };
      const [settingsSnapshot, lalamoveSnapshot, walletSnapshot] = await Promise.all([
        tenantDoc.ref.collection("settings").doc("store").get(),
        tenantDoc.ref.collection("settings").doc("lalamove").get(),
        tenantDoc.ref.collection("settings").doc("lalamoveWallet").get(),
      ]);
      const settings = settingsSnapshot.exists ? settingsSnapshot.data() : {};
      const lalamove = lalamoveSnapshot.exists ? lalamoveSnapshot.data() : {};
      const wallet = walletSnapshot.exists ? walletSnapshot.data() : {};
      return {
        ...tenant,
        shopPhone: Object.hasOwn(settings, "shopPhone")
          ? String(settings.shopPhone || "") : String(tenant.shopPhone || ""),
        shopAddress: Object.hasOwn(settings, "shopAddress")
          ? String(settings.shopAddress || "") : String(tenant.shopAddress || ""),
        lalamove: {
          accountMode: ["disabled", "fod_central", "partner"].includes(String(lalamove.accountMode || ""))
            ? String(lalamove.accountMode)
            : "disabled",
          fodCentralApproved: lalamove.fodCentralApproved === true,
        },
        lalamoveWallet: {
          balance: Math.round((Number(wallet.balance) || 0) * 100) / 100,
          currency: String(wallet.currency || "THB"),
        },
      };
    }));
    return { tenants };
  }
);

exports.createTenant = onCall(
  { region: "asia-southeast1" },
  async request => {
    await assertSuperAdmin(request.auth);

    const name = String(request.data?.name || "").trim();
    const slug = normalizeSlug(request.data?.slug || "");
    const phone = String(request.data?.phone || "").trim();
    const address = String(request.data?.address || "").trim();
    validateTenant(name, slug);

    const db = getFirestore();
    const slugRef = db.collection("tenantSlugs").doc(slug);
    const tenantId = randomUUID();
    const tenantRef = db.collection("tenants").doc(tenantId);
    const settingsRef = tenantRef.collection("settings").doc("store");
    // Enforce the same atomic slug uniqueness as the new one-call provision.
    // A legacy create must not overwrite an in-flight reserved slug.
    await db.runTransaction(async batch => {
      const existing = await batch.get(slugRef);
      if (existing.exists) throw new HttpsError("already-exists", "This slug is already in use");

    batch.create(tenantRef, {
      id: tenantId,
      slug,
      name,
      active: false,
      // A new tenant is not yet activated: trial begins only after its first
      // owner is provisioned; legacy tenants remain unchanged.
      onboardingRequired: true,
      createdBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    batch.create(slugRef, {
      tenantId,
      slug,
      name,
      active: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    batch.create(settingsRef, {
      tenantId,
      shopName: name,
      shopPhone: phone,
      shopAddress: address,
      deliveryFeeNearby: 0,
      deliveryFeeGeneral: 30,
      deliveryFeeFar: 50,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    });
    return { ok: true, tenant: { id: tenantId, slug, name, active: false, onboardingRequired: true } };
  }
);

// Legacy public Callable names must never bypass P1.3c's scoped UUID
// reservation, Auth proof and immutable original first-activation policy.
const tenantOwnerOperation = require("./tenant-owner-operation");
exports.createTenantOwner = tenantOwnerOperation.createTenantOwner;
exports.updateTenantOwner = tenantOwnerOperation.updateTenantOwner;

// Keep existing callable name for older clients, but require the same
// strict operation UUID, original snapshot and CAS as the new endpoint.
// Legacy unversioned batch edits MUST NOT bypass atomic slug ownership.
exports.updateTenant = tenantMasterEdit.updateTenantMasterAtomic;

// Older frontend entrypoint retained, now requiring a strict operation
// receipt, preflight CAS and pristine legacy placeholder proof.
exports.deleteTenant = tenantSafeDeletion.deleteTenant;

function maskAccount(value) {
  const raw = String(value || "").replace(/[^0-9]/g, "");
  return raw.length >= 4 ? "•••• " + raw.slice(-4) : "";
}

// Source-equivalent Tenant Control account summary. Do not return full bank
// or PromptPay identifiers to the browser, and do not claim bank ownership.
exports.getPlatformTenantSavedPaymentAccount = onCall(
  { region: "asia-southeast1" }, async request => {
    await assertSuperAdmin(request.auth);
    const tenantId = String(request.data?.tenantId || "").trim();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(tenantId))
      throw new HttpsError("invalid-argument", "Invalid tenant ID");
    const db = getFirestore();
    const tenantDoc = await db.collection("tenants").doc(tenantId).get();
    if (!tenantDoc.exists) throw new HttpsError("not-found", "Tenant not found");
    const settingsSnap = await tenantDoc.ref.collection("settings").doc("store").get();
    const saved = settingsSnap.exists ? settingsSnap.data() || {} : {};
    return {
      ok: true,
      readOnly: true,
      tenantId,
      source: "firebase_saved_store_settings",
      account: {
        bankName: String(saved.bankName || "").slice(0, 120),
        bankAccountName: String(saved.bankAccountName || "").slice(0, 120),
        bankAccountMasked: maskAccount(saved.bankAccountNumber),
        promptPayMasked: maskAccount(saved.promptPayId),
        promptPayName: String(saved.promptPayName || saved.promptPayAccountName || "").slice(0, 120),
        bankConfigured: Boolean(saved.bankName && saved.bankAccountNumber),
        promptPayConfigured: Boolean(saved.promptPayId),
        deliveryPromptPayEnabled: saved.deliveryPromptPayEnabled !== false,
        ownershipVerified: false,
      },
    };
  },
);

/**
 * Super Admin source-only Hybrid invoice evidence, strictly one verified period.
 * This response is NEVER a M7 finance certification or a payment action.
 */
exports.getPlatformTenantHybridInvoiceEvidence = onCall(
  { region: "asia-southeast1", timeoutSeconds: 25 }, async request => {
    await assertSuperAdmin(request.auth);
    const tenantId = String(request.data?.tenantId || "").trim();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(tenantId))
      throw new HttpsError("invalid-argument", "Invalid tenant ID");
    const ref = getFirestore().collection("tenants").doc(tenantId);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new HttpsError("not-found", "Tenant not found");
    try {
      const response = await readTenantFinanceEvidence({
        tenantRef: ref, tenant: snapshot.data(),
      });
      // Read inconsistency is not an invitation to issue bills or assume zero.
      return response;
    } catch {
      throw new HttpsError("failed-precondition",
        "Tenant finance evidence incomplete; read-only review required",
        { code: "TENANT_FINANCE_EVIDENCE_INCOMPLETE" });
    }
  }
);
