import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildDemoHybridFinanceWorklist, formatHybridFinanceWorklistTH } =
  require("../../functions/hybrid-billing-finance-worklist.js");

const SOURCES = [
  "hybridRefundReferenceClaims", "hybridRefundInstructionClaims",
  "financeSlipClaims", "hybridBillingRefundCandidates",
  "hybridBillingAdjustments", "hybridBillingPaymentAttempts",
  "revenueSharePayments", "lalamoveWalletTopups",
  "lalamoveWalletTransactions", "hybridBillingInvoices",
  "hybridBillingAdjustmentEvents", "hybridBillingAdjustmentBalances",
];
const HARD_BLOCKERS = [
  "EXTERNAL_BANK_STATEMENT_SOURCE_NOT_AUTHENTICATED",
  "LEGACY_OUTGOING_BANK_REFUNDS_NOT_MIGRATED",
  "CROSS_CHANNEL_AND_ARCHIVED_BANK_PAYOUTS_NOT_RECONCILED",
  "NO_ATOMIC_GLOBAL_HISTORICAL_COVERAGE_SNAPSHOT",
];
const makeReport = (extra = {}) => ({
  mode: "demo_inventory_diagnostic_only",
  status: "blocked_manual_finance_reconciliation",
  releaseReady: false, settlementAllowed: false,
  bankSourceAuthenticated: false, historicalBankCoverageVerified: false,
  writesPerformed: false, atomicSnapshot: false,
  sourcesScanned: [...SOURCES],
  counts: { ...Object.fromEntries(SOURCES.map(name => [name, 0])),
    lalamoveWalletDeliveryRefundCredits: 0 },
  integrityIssueCodes: [], integrityIssueCount: 0,
  blockers: [...HARD_BLOCKERS],
  ...extra,
});

test("empty historical database yields four mandatory release blockers, never ALL CLEAR", () => {
  const list = buildDemoHybridFinanceWorklist(makeReport());
  assert.equal(list.kind, "hybrid_finance_review_worklist");
  assert.equal(list.releaseReady, false);
  assert.equal(list.settlementAllowed, false);
  assert.equal(list.bankPaymentConfirmed, false);
  assert.equal(list.bankSourceAuthenticated, false);
  assert.equal(list.historicalBankCoverageVerified, false);
  assert.equal(list.itemCount, 4);
  assert.deepEqual(list.items.map(item => item.code), HARD_BLOCKERS);
  assert.equal(Object.isFrozen(list), true);
  assert.equal(Object.isFrozen(list.items), true);
  assert.ok(list.items.every(item => item.resolved === false && item.evidenceVerified === false));
});

test("corrupt invoice, reserved amount and reviewer produce deterministic Thai finance tasks", () => {
  const codes = ["ADJUSTMENT_RESERVED_BALANCE_MISMATCH",
    "CANDIDATE_INDEPENDENT_REVIEW_MISSING",
    "CANDIDATE_PAID_INVOICE_PROVENANCE_MISSING"];
  const list = buildDemoHybridFinanceWorklist(makeReport({
    integrityIssueCodes: codes, integrityIssueCount: codes.length,
    blockers: [...HARD_BLOCKERS, ...codes],
  }));
  assert.equal(list.itemCount, 7);
  assert.deepEqual(list.items.slice(4).map(item => item.code), [...codes].sort());
  for (const item of list.items) {
    assert.ok(item.actionTH.length > 15);
    assert.ok(item.category);
    assert.ok(["release_blocker", "integrity_exception"].includes(item.severity));
  }
  const rendered = formatHybridFinanceWorklistTH(list);
  assert.match(rendered, /ห้ามยืนยันคืนเงินจริง/);
  assert.match(rendered, /ADJUSTMENT_RESERVED_BALANCE_MISMATCH/);
  assert.match(rendered, /Bank|ธนาคาร/);
  assert.match(rendered, /ยืนยัน Settlement: ไม่ได้/);
});

test("unknown code never echoes attacker-provided bank numbers, HTML or identifiers", () => {
  const leaked = "<account>123-456-7890</account>_raw_transfer_secret";
  const list = buildDemoHybridFinanceWorklist(makeReport({
    integrityIssueCodes: [leaked], integrityIssueCount: 1,
    blockers: [...HARD_BLOCKERS, leaked],
  }));
  assert.equal(list.unknownIntegrityCodeCount, 1);
  assert.equal(list.items.at(-1).code, "UNKNOWN_INTEGRITY_CODE");
  assert.equal(JSON.stringify(list).includes(leaked), false);
  assert.equal(formatHybridFinanceWorklistTH(list).includes(leaked), false);
  assert.equal(list.settlementAllowed, false);
});

test("database counts only: no identity, bank receipt, raw account, transfer or arbitrary fields", () => {
  const report = makeReport({
    counts: { ...makeReport().counts,
      hybridBillingAdjustments: 2, hybridBillingRefundCandidates: 1,
      lalamoveWalletTransactions: 2, lalamoveWalletDeliveryRefundCredits: 1 },
    privateBankAccount: "1234567890", rawSlipOCR: "SECRET",
    externalBankStatement: { rawReference: "123-456-7890" },
  });
  const list = buildDemoHybridFinanceWorklist(report);
  assert.equal(list.counts.hybridBillingAdjustments, 2);
  assert.equal(list.counts.lalamoveWalletDeliveryRefundCredits, 1);
  assert.equal(list.bankPaymentConfirmed, false,
    "Wallet delivery credits are NEVER bank payouts");
  const json = JSON.stringify(list);
  for (const secret of ["privateBankAccount", "1234567890", "rawSlipOCR",
    "externalBankStatement", "rawReference"]) {
    assert.equal(json.includes(secret), false);
  }
});

test("forged ready/paid source reports fail closed before a worklist can be exported", () => {
  for (const variant of [
    { releaseReady: true }, { settlementAllowed: true },
    { bankSourceAuthenticated: true },
    { historicalBankCoverageVerified: true },
    { atomicSnapshot: true }, { writesPerformed: true },
    { mode: "production_approved" }, { status: "settled" },
    { sourcesScanned: SOURCES.slice(0, 11) },
    { sourcesScanned: [...SOURCES].reverse() },
    { blockers: [] },
  ]) {
    assert.throws(() => buildDemoHybridFinanceWorklist(makeReport(variant)),
      /HYBRID_FINANCE_WORKLIST_/);
  }
});

test("noninteger, missing, overbound and inconsistent wallet scan counts fail", () => {
  for (const bad of [
    { hybridBillingRefundCandidates: -1 },
    { hybridBillingInvoices: 501 },
    { financeSlipClaims: Infinity },
    { hybridRefundReferenceClaims: "0" },
    { lalamoveWalletTransactions: 1, lalamoveWalletDeliveryRefundCredits: 2 },
  ]) {
    assert.throws(() => buildDemoHybridFinanceWorklist(makeReport({
      counts: { ...makeReport().counts, ...bad },
    })));
  }
  const missing = makeReport();
  delete missing.counts.hybridBillingInvoices;
  assert.throws(() => buildDemoHybridFinanceWorklist(missing));
});

test("integrity count mismatch and duplicates never yield misleading review output", () => {
  const code = "ADJUSTMENT_RESERVED_BALANCE_MISMATCH";
  for (const variant of [
    { integrityIssueCodes: [code], integrityIssueCount: 0 },
    { integrityIssueCodes: [code, code], integrityIssueCount: 2 },
    { integrityIssueCodes: ["<raw account>", null], integrityIssueCount: 2 },
  ]) assert.throws(() => buildDemoHybridFinanceWorklist(makeReport(variant)),
    /HYBRID_FINANCE_WORKLIST_/);
});

test("Thai text output is deterministic and does not mutate its report or worklist", () => {
  const report = makeReport(), before = structuredClone(report);
  const a = buildDemoHybridFinanceWorklist(report);
  const text1 = formatHybridFinanceWorklistTH(a);
  assert.equal(text1, formatHybridFinanceWorklistTH(buildDemoHybridFinanceWorklist(report)));
  assert.deepEqual(report, before);
  assert.equal(a.writesPerformed, false);
  assert.equal(text1.includes("demo-shop"), false);
  assert.equal(text1.includes("123-456-7890"), false);
  assert.throws(() => formatHybridFinanceWorklistTH({ ...a, settlementAllowed: true }));
});

test("CLI rejects Production project and missing explicit demo consent before Admin import", () => {
  const script = "tools/audit-hybrid-finance-demo.mjs";
  for (const envDelta of [
    { HYBRID_FINANCE_AUDIT_DEMO_ACK: "", GCLOUD_PROJECT: "demo-penguin-hybrid",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" },
    { HYBRID_FINANCE_AUDIT_DEMO_ACK: "1", GCLOUD_PROJECT: "production-live",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" },
    { HYBRID_FINANCE_AUDIT_DEMO_ACK: "1", GCLOUD_PROJECT: "demo-penguin-hybrid",
      FIRESTORE_EMULATOR_HOST: "remote-host:8080" },
    { HYBRID_FINANCE_AUDIT_DEMO_ACK: "1", GCLOUD_PROJECT: "demo-penguin-hybrid",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_CONFIG: JSON.stringify({ projectId: "production-live" }) },
  ]) {
    const proc = spawnSync(process.execPath, [script, "--format=json"], {
      cwd: process.cwd(), encoding: "utf8", timeout: 5000,
      env: { ...process.env, GCP_PROJECT: "demo-penguin-hybrid",
        FIREBASE_CONFIG: "{}", ...envDelta },
    });
    assert.notEqual(proc.status, 0);
    assert.match(proc.stderr, /HYBRID_FINANCE_AUDIT_REFUSES_NONDEMO/);
    assert.doesNotMatch(proc.stdout, /bankReferenceHash|settlementConfirmed:true/);
  }
});

test("CLI help is safe without credentials or Emulator connection", () => {
  const proc = spawnSync(process.execPath,
    ["tools/audit-hybrid-finance-demo.mjs", "--help"], {
      cwd: process.cwd(), encoding: "utf8", timeout: 5000,
      env: { ...process.env, GCLOUD_PROJECT: "production-live",
        FIRESTORE_EMULATOR_HOST: "", HYBRID_FINANCE_AUDIT_DEMO_ACK: "" },
    });
  assert.equal(proc.status, 0);
  assert.match(proc.stdout, /Usage: node tools\/audit-hybrid-finance-demo.mjs/);
  assert.match(proc.stdout, /never confirms a real refund/);
});

test("Worklist/CLI modules are private; no Production callables or database writes", () => {
  const source = fs.readFileSync("functions/hybrid-billing-finance-worklist.js", "utf8");
  const cli = fs.readFileSync("tools/audit-hybrid-finance-demo.mjs", "utf8");
  const prod = fs.readFileSync("functions/index.js", "utf8")
    + fs.readFileSync("functions/bootstrap.js", "utf8");
  assert.doesNotMatch(prod, /hybrid-billing-finance-worklist|audit-hybrid-finance-demo/);
  assert.doesNotMatch(source + cli, /onCall\(|onSchedule\(|runTransaction\(|tx\.create\(|tx\.update\(|uploadBytes\(/);
  assert.match(source, /settlementAllowed: false/);
  assert.match(source, /releaseReady: false/);
  assert.match(cli, /assertDemoEnvironment\(process.env\)/);
  assert.ok(cli.indexOf("assertDemoEnvironment(process.env)")
    < cli.indexOf("fnRequire("));
});
