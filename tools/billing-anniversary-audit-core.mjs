import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { tenantAnchorDate, cycleForDate, previousCompletedCycle } =
  require("../functions/billing-anniversary.js");

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = value => typeof value === "string" && DAY_KEY.test(value) &&
  new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;

function anchorSource(tenant = {}) {
  for (const key of [
    "billingCycleAnchorAt", "revenueShareCycleAnchorAt",
    "hybridBillingActivatedAt", "trialStartsAt", "activatedAt", "createdAt",
  ]) {
    if (tenant[key]) return key;
  }
  return "missing";
}

export function periodsOverlap(a, b) {
  if (![a?.startDate, a?.endDate, b?.startDate, b?.endDate].every(isDay)) return false;
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export function analyzeTenant(id, tenant, payments, asOf, paymentHistoryCapped = false) {
  if (!isDay(asOf)) throw new RangeError("Use a valid Bangkok YYYY-MM-DD as-of date");
  const flags = [];
  const source = anchorSource(tenant);
  let anchor = null;
  try { anchor = tenantAnchorDate(tenant); }
  catch { flags.push("invalid_activation_anchor"); }
  if (!anchor) flags.push("missing_verified_activation_date");
  else if (source !== "billingCycleAnchorAt") flags.push("anchor_not_explicitly_approved");
  if (tenant.revenueShareSuspended === true) flags.push("currently_revenue_share_suspended");
  const effectiveAt = tenant.billingAnniversaryEffectiveAt;
  const effective = Boolean(effectiveAt);
  if (!effective) flags.push("anniversary_cutover_not_authorized");
  const current = anchor ? cycleForDate(anchor, asOf) : null;
  const previous = current ? previousCompletedCycle(anchor, asOf) : null;
  if (anchor && !current) flags.push("tenant_activation_in_future");
  if (paymentHistoryCapped) flags.push("payment_history_scan_truncated");
  const paidPeriods = [];
  const overlapPaymentIds = [];
  const pendingPaymentIds = [];
  let calendarPaymentCount = 0;
  for (const { id: paymentId, ...p } of payments) {
    const periodStart = String(p.periodStart || "");
    const periodEnd = String(p.periodEnd || "");
    if (!isDay(periodStart) || !isDay(periodEnd) || periodEnd < periodStart) {
      flags.push("invalid_historical_payment_period");
      continue;
    }
    const period = { startDate: periodStart, endDate: periodEnd };
    const status = String(p.status || "unknown");
    if (status === "pending") pendingPaymentIds.push(paymentId);
    if (p.periodType === "monthly" && periodStart.endsWith("-01")) calendarPaymentCount++;
    if ([current, previous].filter(Boolean).some(c =>
      periodsOverlap(period, c) &&
      !(periodStart === c.startDate && periodEnd === c.endDate))) {
      overlapPaymentIds.push(paymentId);
    }
    paidPeriods.push({ paymentId, periodStart, periodEnd, status,
      revenueShareAmount: Number(p.revenueShareAmount ?? 0),
      platformAmountDue: Number(p.platformAmountDue ?? p.revenueShareAmount ?? 0) });
  }
  if (overlapPaymentIds.length) flags.push("historical_payment_overlaps_anniversary");
  if (pendingPaymentIds.length) flags.push("payment_awaiting_review");
  if (calendarPaymentCount && anchor && Number(anchor.slice(8, 10)) !== 1) {
    flags.push("calendar_month_payment_history_requires_cutover");
  }
  return {
    tenantId: id, slug: String(tenant.slug || ""), billingMode: String(tenant.billingMode || ""),
    billingPolicyVersion: String(tenant.billingPolicyVersion || ""),
    subscriptionStatus: String(tenant.subscriptionStatus || ""),
    revenueShareEnabled: tenant.revenueShareEnabled === true,
    billingCycle: String(tenant.revenueShareBillingCycle || ""),
    activationAnchorSource: source, activationAnchorDate: anchor,
    billingAnniversaryEffectiveRecorded: effective,
    asOf, currentCycle: current && { startDate: current.startDate, endDate: current.endDate },
    lastCompletedCycle: previous && { startDate: previous.startDate, endDate: previous.endDate },
    nextCycleStartsAt: current?.endExclusiveDate || null,
    paymentCountInspected: paidPeriods.length, calendarPaymentCount,
    overlappingPaymentIds: overlapPaymentIds,
    pendingPaymentIds, historicalPayments: paidPeriods,
    riskFlags: [...new Set(flags)].sort(),
    auditDecision: flags.length ? "REVIEW_REQUIRED" : "CANDIDATE_ONLY_NOT_APPROVED",
  };
}
