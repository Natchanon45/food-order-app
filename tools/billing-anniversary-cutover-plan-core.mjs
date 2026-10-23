import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { validDateKey, cycleForDate } = require("../functions/billing-anniversary.js");

const HARD_BLOCKERS = new Set([
  "invalid_activation_anchor", "missing_verified_activation_date",
  "tenant_activation_in_future", "payment_history_scan_truncated",
  "historical_payment_overlaps_anniversary", "invalid_historical_payment_period",
  "payment_awaiting_review", "currently_revenue_share_suspended",
  "calendar_month_payment_history_requires_cutover",
]);

function classify(tenant) {
  if (tenant.revenueShareEnabled || tenant.billingMode === "revenue_share") {
    return tenant.billingCycle === "daily" ? "revenue_share_daily" : "revenue_share_monthly";
  }
  if (tenant.billingMode === "subscription") return "premium_subscription";
  if (!tenant.billingMode && tenant.revenueShareEnabled === false) {
    return "legacy_subscription_mode_unverified";
  }
  return "unknown_billing_contract";
}

/**
 * No Firestore access, financial writes, migrations or automatic approvals.
 * This is an advisory proposal; a future cutover requires audited tenant
 * consent, saved snapshot/version, and a separate explicit deployment.
 */
export function proposeCutover(tenant = {}, asOf) {
  validDateKey(asOf);
  const category = classify(tenant);
  const flags = [...new Set(tenant.riskFlags || [])];
  const blockers = flags.filter(flag => HARD_BLOCKERS.has(flag));
  const anchor = tenant.activationAnchorDate || null;
  let candidate = null;
  if (anchor) {
    try {
      validDateKey(anchor);
      const current = cycleForDate(anchor, asOf);
      candidate = current ? current.endExclusiveDate : (anchor > asOf ? anchor : null);
    } catch {
      blockers.push("invalid_activation_anchor");
    }
  } else blockers.push("missing_verified_activation_date");
  if (tenant.billingAnniversaryEffectiveRecorded) blockers.push("cutover_already_recorded");
  if (tenant.subscriptionStatus === "suspended") blockers.push("subscription_suspended");
  if (category === "unknown_billing_contract") blockers.push("billing_contract_unknown");
  if (category === "legacy_subscription_mode_unverified") blockers.push("billing_mode_not_explicit");
  if (category === "revenue_share_monthly") blockers.push("monthly_invoice_bridge_not_evaluated");
  if (!candidate) blockers.push("no_future_anniversary");
  const stableBlockers = [...new Set(blockers)].sort();

  const canAdvanceToManualReview = stableBlockers.length === 0;
  return {
    category,
    // Advisory date is NOT an effective-date instruction.
    nextAnniversaryCandidate: candidate,
    proposedEffectiveDate: canAdvanceToManualReview ? candidate : null,
    reviewStatus: stableBlockers.length ? "BLOCKED_REVIEW" : "PENDING_MANUAL_APPROVAL",
    blockers: stableBlockers,
    requiredChecks: [
      "Confirm store activation-day timestamp and owner billing agreement",
      "Re-read revenueSharePayments and subscriptions at the actual cutover date",
      "Compare old calendar and new anniversary threshold charges for transition days",
      "Preserve all prior approved/pending/rejected invoices and Wallet debit ledger",
      "Do not change subscriptionExpiresAt, gracePeriodDays, or suspension flags",
      ...(category === "revenue_share_daily"
        ? ["Keep share slip/payment cadence daily; reset only cumulative Delivery threshold"]
        : ["Verify current Premium term and eligibility separately from Delivery threshold"]),
    ],
    safety: "DRY_RUN_ONLY_NO_FIRESTORE_WRITES_NO_STATUS_CHANGES",
  };
}

export function generateCutoverPlan(audit, today) {
  if (audit?.format !== "penguin-anniversary-inventory-v1" ||
      !Array.isArray(audit.tenants)) throw new Error("Unsupported audit inventory format");
  validDateKey(today);
  validDateKey(audit.asOfBangkok);
  // Must not use stale or truncated inventory as a migration authorization.
  const inputIncomplete = audit.tenantScanTruncated === true;
  const stores = audit.tenants.map((tenant, i) => {
    const proposal = proposeCutover(tenant, today);
    return {
      shop: "SHOP_" + (i + 1),
      tenantId: tenant.tenantId,
      anchorDate: tenant.activationAnchorDate || null,
      subscriptionStatus: tenant.subscriptionStatus || "",
      revenueShareBillingCycle: tenant.billingCycle || "",
      oldPaymentCount: tenant.paymentCountInspected || 0,
      inputAuditAsOf: audit.asOfBangkok,
      ...proposal,
      ...(inputIncomplete ? { reviewStatus: "BLOCKED_REVIEW",
        proposedEffectiveDate: null,
        blockers: [...proposal.blockers, "tenant_inventory_truncated"].sort() } : {}),
    };
  });
  return {
    format: "penguin-anniversary-cutover-dry-run-v1",
    auditAsOfBangkok: audit.asOfBangkok,
    plannedAsOfBangkok: today,
    auditExpired: today < audit.asOfBangkok ||
      (Date.parse(today + "T00:00:00Z") - Date.parse(audit.asOfBangkok + "T00:00:00Z")) > 7 * 86400000,
    tenantCount: stores.length,
    blocked: stores.filter(t => t.reviewStatus === "BLOCKED_REVIEW").length,
    pendingManualApproval: stores.filter(t => t.reviewStatus === "PENDING_MANUAL_APPROVAL").length,
    decision: "INFORMATION_ONLY_NO_CUTOVER_AUTHORIZED",
    stores,
  };
}
