"use strict";

// Internal day-close orchestration, intentionally NOT exported in index.js.
// Do not schedule/deploy before bank reconciliation, Storage and staged E2E
// release gates are satisfied.
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore } = require("firebase-admin/firestore");
const { dateKey, prevDate, billingCycle } = require("./hybrid-billing-core");
const { issueHybridInvoicesForClosedDay } = require("./hybrid-billing-ledger");
const { reconcileHybridArrears } = require("./hybrid-billing-arrears");

async function runHybridBillingDaily({
  db, now = new Date(), maximumTenants = 200,
  issue = issueHybridInvoicesForClosedDay,
  reconcile = reconcileHybridArrears,
}) {
  if (!db || !(now instanceof Date) || !Number.isFinite(now.getTime())
    || !Number.isSafeInteger(maximumTenants) || maximumTenants < 1
    || maximumTenants > 1000) throw Error("HYBRID_DAILY_INVALID_REQUEST");
  const today = dateKey(now), previous = prevDate(today);
  // Do not list tenant IDs externally. A maximum-size scan fails before
  // issuing anything to avoid an incomplete silent run for large platforms.
  const snap = await db.collection("tenants")
    .where("billingPolicyVersion", "==", "hybrid_v1")
    .where("hybridBillingEnabled", "==", true)
    .orderBy("__name__").limit(maximumTenants + 1).get();
  if (!snap || !Array.isArray(snap.docs) || snap.size !== snap.docs.length) {
    throw Error("HYBRID_DAILY_TENANT_SCAN_INCOMPLETE");
  }
  if (snap.size > maximumTenants) throw Error("HYBRID_DAILY_TENANT_LIMIT");
  const outcomes = [];
  for (const doc of snap.docs) {
    const tenantId = doc.id, tenant = doc.data() || {};
    if (tenant.billingPolicyVersion !== "hybrid_v1"
      || tenant.hybridBillingEnabled !== true
      || typeof tenant.hybridBillingStartDate !== "string") {
      throw Error("HYBRID_DAILY_BAD_TENANT:" + tenantId);
    }
    let closeResult = { skipped: true };
    if (previous >= tenant.hybridBillingStartDate) {
      // Calculate the cycle of YESTERDAY. Never use the new cycle at a
      // signup-anniversary boundary, otherwise the previous day's invoices
      // could disappear from this run.
      const cycle = billingCycle(tenant.hybridBillingStartDate, previous);
      closeResult = await issue({ db, tenantId, cycleId: cycle.id, now });
    }
    const arrearsResult = await reconcile({ db, tenantId, now });
    outcomes.push({ tenantId, closeResult, arrears: arrearsResult.status });
  }
  return { today, previous, scanned: snap.size, outcomes };
}

// Module-local candidate only; not exported through deployed functions/index.js.
const hybridBillingDailyCandidate = onSchedule({
  schedule: "30 0 * * *", timeZone: "Asia/Bangkok", region: "asia-southeast1",
  timeoutSeconds: 540,
}, async () => {
  await runHybridBillingDaily({ db: getFirestore() });
});
module.exports = { runHybridBillingDaily, hybridBillingDailyCandidate };
