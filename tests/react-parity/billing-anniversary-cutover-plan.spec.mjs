import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateCutoverPlan, proposeCutover } from "../../tools/billing-anniversary-cutover-plan-core.mjs";
import { parseArgs } from "../../tools/plan-billing-anniversary-cutover.mjs";

const tenant = (anchorDate, data = {}) => ({
  activationAnchorDate: anchorDate, billingAnniversaryEffectiveRecorded: false,
  paymentCountInspected: 0, subscriptionStatus: "active",
  riskFlags: ["anchor_not_explicitly_approved", "anniversary_cutover_not_authorized"],
  ...data,
});
const inventory = (tenants, asOf = "2026-10-23", incomplete = false) => ({
  format: "penguin-anniversary-inventory-v1",
  asOfBangkok: asOf, tenantScanTruncated: incomplete,
  tenants: tenants.map((t, i) => ({ tenantId: "fixture-" + (i + 1), ...t })),
});

test("daily revenue-share tenant can only reach manual review for Nov 21 reset", () => {
  const p = proposeCutover(tenant("2026-06-21", {
    billingMode: "revenue_share", revenueShareEnabled: true, billingCycle: "daily",
  }), "2026-10-23");
  assert.equal(p.category, "revenue_share_daily");
  assert.equal(p.nextAnniversaryCandidate, "2026-11-21");
  assert.equal(p.reviewStatus, "PENDING_MANUAL_APPROVAL");
  assert.equal(p.proposedEffectiveDate, "2026-11-21");
  assert.match(p.requiredChecks.join(" "), /daily/);
  assert.match(p.safety, /NO_FIRESTORE_WRITES/);
});

test("suspended yearly legacy subscription cannot be cut over or reactivated", () => {
  const p = proposeCutover(tenant("2026-07-04", {
    billingMode: "", revenueShareEnabled: false,
    subscriptionStatus: "suspended", planCode: "yearly",
  }), "2026-10-23");
  assert.equal(p.nextAnniversaryCandidate, "2026-11-04");
  assert.equal(p.category, "legacy_subscription_mode_unverified");
  assert.equal(p.reviewStatus, "BLOCKED_REVIEW");
  assert.equal(p.proposedEffectiveDate, null);
  assert.ok(p.blockers.includes("subscription_suspended"));
  assert.ok(p.blockers.includes("billing_mode_not_explicit"));
  assert.match(p.requiredChecks.join(" "), /subscriptionExpiresAt/);
});

test("active monthly legacy subscription remains gated without explicit mode", () => {
  const p = proposeCutover(tenant("2026-06-22", {
    billingMode: "", revenueShareEnabled: false,
    subscriptionStatus: "active", planCode: "monthly",
  }), "2026-10-23");
  assert.equal(p.nextAnniversaryCandidate, "2026-11-22");
  assert.equal(p.reviewStatus, "BLOCKED_REVIEW");
  assert.ok(p.blockers.includes("billing_mode_not_explicit"));
});

test("historic financial overlap, pending slip, and truncated history are hard blockers", () => {
  for (const flag of ["historical_payment_overlaps_anniversary",
    "payment_awaiting_review", "payment_history_scan_truncated"]) {
    const p = proposeCutover(tenant("2026-06-22", {
      billingMode: "revenue_share", revenueShareEnabled: true, billingCycle: "daily",
      riskFlags: [flag],
    }), "2026-10-23");
    assert.equal(p.reviewStatus, "BLOCKED_REVIEW", flag);
    assert.equal(p.proposedEffectiveDate, null, flag);
  }
});

test("31-day anchors clamp in November but preserve original day in December", () => {
  const t = tenant("2026-01-31", {
    billingMode: "revenue_share", billingCycle: "daily", revenueShareEnabled: true,
  });
  assert.equal(proposeCutover(t, "2026-10-23").nextAnniversaryCandidate, "2026-10-31");
  assert.equal(proposeCutover(t, "2026-11-29").nextAnniversaryCandidate, "2026-11-30");
  assert.equal(proposeCutover(t, "2026-11-30").nextAnniversaryCandidate, "2026-12-31");
});

test("three sample stores are grouped without authorizing any production writes", () => {
  const audit = inventory([
    tenant("2026-06-21", { billingMode: "revenue_share", billingCycle: "daily", revenueShareEnabled: true }),
    tenant("2026-07-04", { billingMode: "", revenueShareEnabled: false, subscriptionStatus: "suspended" }),
    tenant("2026-06-22", { billingMode: "", revenueShareEnabled: false }),
  ]);
  const plan = generateCutoverPlan(audit, "2026-10-23");
  assert.equal(plan.tenantCount, 3);
  assert.equal(plan.pendingManualApproval, 1);
  assert.equal(plan.blocked, 2);
  assert.deepEqual(plan.stores.map(r => r.nextAnniversaryCandidate),
    ["2026-11-21", "2026-11-04", "2026-11-22"]);
  assert.equal(plan.decision, "INFORMATION_ONLY_NO_CUTOVER_AUTHORIZED");
});

test("stale and truncated scans forbid proposed effective dates", () => {
  const t = tenant("2026-06-21", {
    billingMode: "revenue_share", billingCycle: "daily", revenueShareEnabled: true,
  });
  for (const [audit, today, expected] of [
    [inventory([t], "2026-10-01"), "2026-10-23", "audit_is_stale"],
    [inventory([t], "2026-10-23", true), "2026-10-23", "tenant_inventory_truncated"],
  ]) {
    const plan = generateCutoverPlan(audit, today);
    assert.equal(plan.blocked, 1);
    assert.equal(plan.stores[0].proposedEffectiveDate, null);
    assert.ok(plan.stores[0].blockers.includes(expected));
  }
});

test("local planner accepts only two separate .json paths and cannot write to repository", () => {
  const good = parseArgs(["--audit", "/tmp/existing-audit.json", "--out", "/tmp/proposed-plan.json"]);
  assert.equal(good.input, "/tmp/existing-audit.json");
  assert.equal(good.output, "/tmp/proposed-plan.json");
  assert.throws(() => parseArgs(["--out", "/tmp/plan.json"]), /Provide/);
  assert.throws(() => parseArgs(["--audit", "/tmp/audit.json",
    "--out", "tools/cutover-private.json"]), /outside the Git repository/);
  assert.throws(() => parseArgs(["--audit", "/tmp/audit.json",
    "--out", "/tmp/audit.json"]), /must differ/);
});

test("cutover planner contains no Firestore connections, network calls or tenant writes", () => {
  const core = fs.readFileSync("tools/billing-anniversary-cutover-plan-core.mjs", "utf8");
  const cli = fs.readFileSync("tools/plan-billing-anniversary-cutover.mjs", "utf8");
  assert.doesNotMatch(core + cli, /firebase-admin|firebase-functions|applicationDefault|getFirestore|https\.request|fetch\(/);
  assert.doesNotMatch(cli, /\.collection\(|\.update\(|\.set\(|\.delete\(/);
  assert.match(cli, /mode: 0o600, flag: "wx"/);
});
