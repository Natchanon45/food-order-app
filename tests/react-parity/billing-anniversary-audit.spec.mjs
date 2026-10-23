import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { analyzeTenant, periodsOverlap } from "../../tools/billing-anniversary-audit-core.mjs";
import { argsFrom } from "../../tools/audit-billing-anniversary.mjs";

const active = {
  slug: "example-store", billingMode: "revenue_share",
  billingCycleAnchorAt: "2026-10-22T00:00:00+07:00",
  billingAnniversaryEffectiveAt: "2026-10-22T00:00:00+07:00",
};

test("read-only audit finds an approved calendar invoice overlapping tenant anniversary", () => {
  const row = analyzeTenant("tenant-1", active, [
    { id: "old-paid", periodType: "monthly", periodStart: "2026-10-01",
      periodEnd: "2026-10-31", status: "approved", revenueShareAmount: 150 },
  ], "2026-10-23");
  assert.deepEqual(row.currentCycle, { startDate: "2026-10-22", endDate: "2026-11-21" });
  assert.ok(row.riskFlags.includes("historical_payment_overlaps_anniversary"));
  assert.ok(row.riskFlags.includes("calendar_month_payment_history_requires_cutover"));
  assert.deepEqual(row.overlappingPaymentIds, ["old-paid"]);
  assert.equal(row.auditDecision, "REVIEW_REQUIRED");
});

test("matching approved anniversary invoice is not a conflicting overlap", () => {
  const row = analyzeTenant("tenant-1", active, [
    { id: "same-cycle", periodType: "monthly", periodStart: "2026-10-22",
      periodEnd: "2026-11-21", status: "approved" },
  ], "2026-10-23");
  assert.deepEqual(row.overlappingPaymentIds, []);
  assert.equal(row.auditDecision, "CANDIDATE_ONLY_NOT_APPROVED");
});

test("existing tenant missing effective cutover never gets an automatic approval", () => {
  const row = analyzeTenant("tenant-2", {
    billingMode: "subscription", createdAt: "2026-10-15T00:00:00+07:00",
  }, [], "2026-10-23");
  assert.equal(row.activationAnchorDate, "2026-10-15");
  assert.equal(row.activationAnchorSource, "createdAt");
  assert.ok(row.riskFlags.includes("anchor_not_explicitly_approved"));
  assert.ok(row.riskFlags.includes("anniversary_cutover_not_authorized"));
});

test("31 January anchor returns to 31 March and reports exact February boundaries", () => {
  const row = analyzeTenant("tenant-3", {
    billingCycleAnchorAt: "2026-01-31T00:00:00+07:00",
    billingAnniversaryEffectiveAt: "2026-01-31T00:00:00+07:00",
  }, [], "2026-02-28");
  assert.deepEqual(row.currentCycle, { startDate: "2026-02-28", endDate: "2026-03-30" });
  assert.deepEqual(row.lastCompletedCycle, { startDate: "2026-01-31", endDate: "2026-02-27" });
  assert.equal(row.nextCycleStartsAt, "2026-03-31");
});

test("payment history cap, pending slips and invalid dates all require review", () => {
  const row = analyzeTenant("tenant-4", active, [
    { id: "pending", periodStart: "2026-10-22", periodEnd: "2026-11-21", status: "pending" },
    { id: "broken", periodStart: "2026-02-30", periodEnd: "2026-03-30", status: "approved" },
  ], "2026-10-23", true);
  for (const flag of [
    "payment_awaiting_review", "payment_history_scan_truncated",
    "invalid_historical_payment_period",
  ]) assert.ok(row.riskFlags.includes(flag), flag);
});

test("audit never invents an activation anchor", () => {
  const row = analyzeTenant("tenant-5", {}, [], "2026-10-23");
  assert.equal(row.activationAnchorDate, null);
  assert.equal(row.currentCycle, null);
  assert.ok(row.riskFlags.includes("missing_verified_activation_date"));
  assert.equal(periodsOverlap({ startDate: "2026-01-01", endDate: "2026-01-31" },
    { startDate: "2026-01-31", endDate: "2026-02-28" }), true);
});

test("audit requires an explicit project and a report path outside the repo", () => {
  assert.throws(() => argsFrom(["--project", "chat-45754"]), /--out/);
  assert.throws(() => argsFrom(["--project", "chat-45754", "--out",
    "tools/financial-data.json"]), /outside repository/);
  assert.throws(() => argsFrom(["--project", "chat-45754", "--out",
    "/tmp/billing-audit.json", "--payments-limit", "999"]), /payments-limit/);
  const accepted = argsFrom(["--project", "chat-45754",
    "--out", "/tmp/billing-audit.json", "--max-tenants", "10"]);
  assert.equal(accepted.max, 10);
});

test("operational CLI includes no Firestore mutations and writes local output exclusively", () => {
  const source = fs.readFileSync("tools/audit-billing-anniversary.mjs", "utf8");
  assert.doesNotMatch(source, /\b(?:db|ref|doc|batch|transaction)\.(?:set|update|delete|add|commit|create)\s*\(/);
  assert.match(source, /writeFile\(out, JSON\.stringify\(result/);
  assert.match(source, /flag: "wx", mode: 0o600/);
});
