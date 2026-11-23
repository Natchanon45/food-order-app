const { HttpsError, onCall } = require("./managed-email-callable");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const cmdPolicy = require("./tenant-subscription-command-policy");

const DEFAULT_GRACE_DAYS = 3;

async function assertSuperAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const profile = (await getFirestore().collection("users").doc(auth.uid).get()).data();
  if (!profile || profile.active === false || profile.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Super admin permission required");
  }
}

function addDays(date, days) {
  return new Date(date.getTime() + Number(days || 0) * 86400000);
}

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function revenueShareEnabled(tenant = {}) {
  return tenant.revenueShareEnabled === true || tenant.billingMode === "revenue_share";
}

function effectiveStatus(tenant, now = new Date()) {
  if (revenueShareEnabled(tenant)) return tenant.revenueShareSuspended === true ? "revenue_share_suspended" : "revenue_share_active";
  if (tenant.subscriptionStatus === "suspended" || tenant.active === false && tenant.suspensionReason) return "suspended";
  const expiresAt = asDate(tenant.subscriptionExpiresAt);
  if (!expiresAt) return tenant.subscriptionStatus || "active";
  const graceDays = Number(tenant.gracePeriodDays ?? DEFAULT_GRACE_DAYS);
  const graceEndsAt = addDays(expiresAt, graceDays);
  if (now <= expiresAt) {
    const trialEndsAt = asDate(tenant.trialEndsAt);
    return tenant.subscriptionStatus === "trialing" && trialEndsAt && now <= trialEndsAt
      ? "trialing" : "active";
  }
  if (now <= graceEndsAt) return "grace";
  return "expired";
}

// The complete first subscription (including immutable activation and trial)
// is created ONLY by the explicit new-owner/public-signup flow. A Firestore
// "on create" trigger is not independent evidence of the original signup
// anniversary for imports or historical shops. This trigger is intentionally
// diagnostic only; never create a new trial from the import timestamp.
exports.initializeTenantSubscription = onDocumentCreated(
  { document: "tenants/{tenantId}", region: "asia-southeast1" },
  async event => {
    const snapshot = event.data;
    if (!snapshot) return;
    const tenant = snapshot.data() || {};
    if (tenant.billingPolicyVersion === "hybrid_v1" ||
      tenant.onboardingRequired === true) return;
    if (tenant.subscriptionExpiresAt || revenueShareEnabled(tenant)) return;
    console.warn("SUBSCRIPTION_ORIGINAL_ENROLLMENT_REQUIRED", {
      tenantId: event.params.tenantId,
      reason: "NO_CONFIRMED_ORIGINAL_EXPIRY",
    });
    // No subscription or store access mutation here.
  }
);

exports.backfillTenantSubscriptions = onCall(
  { region: "asia-southeast1" },
  async request => {
    await assertSuperAdmin(request.auth);
    // Historical membership dates are not interchangeable with the date
    // this Superadmin opened the page. Preserve old records for explicit
    // original-enrollment reconciliation, never grant a new free trial.
    throw new HttpsError("failed-precondition",
      "SUBSCRIPTION_HISTORICAL_BACKFILL_REQUIRES_ORIGINAL_EVIDENCE");
  }
);

// Superadmin-only non-financial legacy subscription control. The tenant,
// mirrored URL index and immutable operation receipt must commit atomically.
// Never use a best-effort non-transactional batch for a paid-access change.
exports.updateTenantSubscription = onCall(
  { region: "asia-southeast1", timeoutSeconds: 45 },
  async request => {
    await assertSuperAdmin(request.auth);
    let input;
    try { input=cmdPolicy.validate(request.data); }
    catch(error){ throw new HttpsError("invalid-argument",error.code||"INVALID_SUBSCRIPTION_REQUEST"); }
    const db=getFirestore();
    const tenantRef=db.collection("tenants").doc(input.tenantId);
    const opRef=tenantRef.collection("subscriptionAdminActions").doc(input.operationId);
    const actorRef=db.collection("users").doc(request.auth.uid);
    const digest=cmdPolicy.fingerprint(input);
    let answer;
    try{
      answer=await db.runTransaction(async tx=>{
        const [actorSnap,receiptSnap,tenantSnap]=await Promise.all([
          tx.get(actorRef),tx.get(opRef),tx.get(tenantRef),
        ]);
        if(actorSnap.data()?.role!=="super_admin"||actorSnap.data()?.active===false)
          throw new HttpsError("permission-denied","Superadmin role changed");
        if(receiptSnap.exists){
          const saved=receiptSnap.data()||{};
          if(saved.actor!==request.auth.uid||saved.requestDigest!==digest||
             saved.tenantId!==input.tenantId||saved.kind!=="legacy_subscription_control_v1")
            throw new HttpsError("already-exists","Operation ID used with different input");
          return cmdPolicy.response(saved,true);
        }
        if(!tenantSnap.exists)throw new HttpsError("not-found","Tenant not found");
        const tenant=tenantSnap.data()||{};
        let patch;
        try{patch=cmdPolicy.next(tenant,input,new Date());}
        catch(error){throw new HttpsError("failed-precondition",error.code||"SUBSCRIPTION_POLICY_REJECTED");}
        const before=cmdPolicy.view(tenant);
        const slug=String(tenant.slug||"").trim();
        const slugRef=slug?db.collection("tenantSlugs").doc(slug):null;
        const slugSnap=slugRef?await tx.get(slugRef):null;
        if(!slugRef||!slugSnap?.exists)
          throw new HttpsError("failed-precondition","SUBSCRIPTION_SLUG_INDEX_MISSING");
        if(slugSnap.data()?.tenantId!==input.tenantId)
          throw new HttpsError("failed-precondition","SUBSCRIPTION_SLUG_INDEX_MISMATCH");
        const now=Timestamp.now();
        const row=cmdPolicy.receipt({tenantId:input.tenantId,
          operationId:input.operationId,actor:request.auth.uid,action:input.action,
          input,patch,previous:before,at:now});
        const change={
          planCode:patch.planCode,
          subscriptionStatus:patch.subscriptionStatus,
          subscriptionExpiresAt:patch.subscriptionExpiresAt?
            Timestamp.fromDate(patch.subscriptionExpiresAt):null,
          gracePeriodDays:patch.gracePeriodDays,
          active:patch.active,
          suspensionReason:patch.suspensionReason,
          suspendedAt:patch.suspendedAt?
            (tenant.suspendedAt||now):null,
          subscriptionAdminRevision:patch.subscriptionAdminRevision,
          subscriptionUpdatedBy:request.auth.uid,
          updatedAt:now,
        };
        tx.update(tenantRef,change);
        tx.update(slugRef,{
          active:patch.active,
          subscriptionStatus:patch.subscriptionStatus,
          subscriptionExpiresAt:change.subscriptionExpiresAt,
          gracePeriodDays:patch.gracePeriodDays,updatedAt:now,
        });
        // Immutable receipt is the sole authority for operation recovery.
        tx.create(opRef,row);
        return cmdPolicy.response(row,false);
      });
    }catch(error){
      if(error instanceof HttpsError)throw error;
      // Firestore may have committed before transport failure. Do not
      // signal safe-to-retry from an unknown transaction result.
      throw new HttpsError("unavailable","SUBSCRIPTION_WRITE_OUTCOME_UNKNOWN",{
        code:"SUBSCRIPTION_WRITE_OUTCOME_UNKNOWN"});
    }
    return answer;
  }
);

exports.getPlatformTenantSubscriptionOperation = onCall(
  { region: "asia-southeast1", timeoutSeconds: 30 },
  async request => {
    await assertSuperAdmin(request.auth);
    const data=request.data;
    if(!data||typeof data!=="object"||Array.isArray(data)||
      Object.keys(data).length!==2||
      !/^[A-Za-z0-9_-]{4,128}$/.test(data.tenantId||"")||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(data.operationId||""))
      throw new HttpsError("invalid-argument","SUBSCRIPTION_OPERATION_SELECTOR_INVALID");
    const db=getFirestore();
    const tenantRef=db.collection("tenants").doc(data.tenantId);
    const opRef=tenantRef.collection("subscriptionAdminActions").doc(data.operationId);
    const [receipt,tenant]=await Promise.all([opRef.get(),tenantRef.get()]);
    const base={ok:true,readOnly:true,tenantId:data.tenantId,
      operationId:data.operationId,canIssueInvoice:false,
      canSettleMoney:false,canReleaseFinancialHold:false,
      tenant:null};
    if(!receipt.exists)return {...base,status:"not_found"};
    const row=receipt.data()||{};
    if(row.actor!==request.auth.uid)
      throw new HttpsError("permission-denied","Operation created by another Superadmin");
    if(row.kind!=="legacy_subscription_control_v1"||
       !row.after||!tenant.exists)return {...base,status:"review_required"};
    const latest=tenant.data()||{};
    const publicSlug=String(latest.slug||"");
    if(!publicSlug)return {...base,status:"review_required"};
    const slugSnap=await db.collection("tenantSlugs").doc(publicSlug).get();
    if(!slugSnap.exists||slugSnap.data()?.tenantId!==data.tenantId)
      return {...base,status:"review_required"};
    const current=cmdPolicy.view(latest);
    const publicCurrent=cmdPolicy.view({
      ...latest,
      subscriptionExpiresAt:slugSnap.data().subscriptionExpiresAt,
      subscriptionStatus:slugSnap.data().subscriptionStatus,
      gracePeriodDays:slugSnap.data().gracePeriodDays,
      active:slugSnap.data().active,
    });
    if(current.expiry!==publicCurrent.expiry||
      current.status!==publicCurrent.status||
      current.grace!==publicCurrent.grace||
      current.active!==publicCurrent.active)
      return {...base,status:"review_required"};
    const saved=row.after;
    const exact=current.expiry===saved.expiry&&
      current.status===saved.status&&current.active===saved.active&&
      current.planCode===saved.planCode&&current.grace===saved.grace&&
      current.revision===saved.revision;
    if(!Number.isSafeInteger(saved.revision)||saved.revision<1)
      return {...base,status:"review_required"};
    return {...base,status:exact?"complete_current":"complete_superseded",
      tenant:exact?{
        id:data.tenantId,subscriptionStatus:current.status,
        subscriptionExpiresAt:current.expiry,active:current.active,
        planCode:current.planCode,gracePeriodDays:current.grace,
        subscriptionAdminRevision:current.revision,
      }:null};
  }
);

exports.syncExpiredTenants = onSchedule(
  { schedule: "every day 00:15", timeZone: "Asia/Bangkok", region: "asia-southeast1" },
  async () => {
    const db = getFirestore();
    const snapshot = await db.collection("tenants").get();
    let changed = 0;
    for (const tenantDoc of snapshot.docs) {
      const didChange = await db.runTransaction(async tx => {
        const fresh = await tx.get(tenantDoc.ref);
        if (!fresh.exists) return false;
        const tenant = fresh.data() || {};
        if (tenant.billingPolicyVersion === "hybrid_v1" || tenant.onboardingRequired === true) return false;
        if (revenueShareEnabled(tenant) || tenant.revenueShareSuspended === true) return false;
        if (!tenant.subscriptionExpiresAt) {
          // Do not invent a membership anniversary for historical tenants.
          // Its original activation/evidence must be reviewed separately.
          return false;
        }
        if (tenant.subscriptionStatus === "suspended") return false;
        const status = effectiveStatus(tenant);
        const active = (status === "active" || status === "grace" || status === "trialing")
          && !cmdPolicy.independentHold(tenant);
        if (status === tenant.subscriptionStatus && active === (tenant.active !== false))
          return false;
        const slug=String(tenant.slug||"").trim();
        if(!slug)return false;
        const slugRef=db.collection("tenantSlugs").doc(slug);
        const index=await tx.get(slugRef);
        if(!index.exists||index.data()?.tenantId!==tenantDoc.id){
          console.warn("SUBSCRIPTION_SYNC_SLUG_UNVERIFIED",{tenantId:tenantDoc.id});
          return false;
        }
        const now=Timestamp.now();
        tx.update(tenantDoc.ref,{
          subscriptionStatus:status,active,updatedAt:now,
        });
        tx.update(slugRef,{
          subscriptionStatus:status,active,updatedAt:now,
          subscriptionExpiresAt:tenant.subscriptionExpiresAt,
          gracePeriodDays:tenant.gracePeriodDays??DEFAULT_GRACE_DAYS,
        });
        return true;
      });
      if(didChange)changed+=1;
    }
    console.log("Tenant subscription sync completed", { changed });
  }
);
