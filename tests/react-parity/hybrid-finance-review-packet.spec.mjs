import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildDemoHybridFinanceWorklist } =
  require("../../functions/hybrid-billing-finance-worklist.js");
const { createDemoHybridFinanceReviewPacket, verifyDemoHybridFinanceReviewPacket } =
  require("../../functions/hybrid-billing-finance-review-packet.js");

const sources = [
  "hybridRefundReferenceClaims", "hybridRefundInstructionClaims",
  "financeSlipClaims", "hybridBillingRefundCandidates",
  "hybridBillingAdjustments", "hybridBillingPaymentAttempts",
  "revenueSharePayments", "lalamoveWalletTopups",
  "lalamoveWalletTransactions", "hybridBillingInvoices",
  "hybridBillingAdjustmentEvents", "hybridBillingAdjustmentBalances",
];
const mandatory = [
  "EXTERNAL_BANK_STATEMENT_SOURCE_NOT_AUTHENTICATED",
  "LEGACY_OUTGOING_BANK_REFUNDS_NOT_MIGRATED",
  "CROSS_CHANNEL_AND_ARCHIVED_BANK_PAYOUTS_NOT_RECONCILED",
  "NO_ATOMIC_GLOBAL_HISTORICAL_COVERAGE_SNAPSHOT",
];
const onDate = "2026-10-24T12:34:56.000Z";
const fixture = ({ codes = [], counts = {} } = {}) =>
  buildDemoHybridFinanceWorklist({
    mode: "demo_inventory_diagnostic_only",
    status: "blocked_manual_finance_reconciliation",
    releaseReady: false, settlementAllowed: false,
    bankSourceAuthenticated: false, historicalBankCoverageVerified: false,
    atomicSnapshot: false, writesPerformed: false,
    sourcesScanned: [...sources],
    counts: { ...Object.fromEntries(sources.map(k => [k, 0])),
      lalamoveWalletDeliveryRefundCredits: 0, ...counts },
    integrityIssueCodes: codes, integrityIssueCount: codes.length,
    blockers: [...mandatory, ...codes],
  });
const make = opts => createDemoHybridFinanceReviewPacket(
  fixture(opts), { generatedAt: onDate },
);
const copy = x => structuredClone(x);
const digestCore = packet => {
  const { checksumSha256, checksumIsBankAttestation, ...core } = packet;
  return createHash("sha256").update(
    "penguin-hybrid-finance-review-packet-v1\n" + JSON.stringify(core), "utf8",
  ).digest("hex");
};

test("packet from empty Emulator always carries mandatory blockers and cannot approve a payout", () => {
  const packet = make();
  assert.equal(packet.format, "hybrid_finance_review_packet_v1");
  assert.equal(packet.projectId, "demo-penguin-hybrid");
  assert.equal(packet.worklist.itemCount, 4);
  assert.deepEqual(packet.worklist.items.map(x => x.code), mandatory);
  assert.equal(packet.bankPaymentConfirmed, false);
  assert.equal(packet.bankSourceAuthenticated, false);
  assert.equal(packet.settlementAllowed, false);
  assert.equal(packet.releaseReady, false);
  assert.equal(packet.digitallySigned, false);
  const result = verifyDemoHybridFinanceReviewPacket(packet);
  assert.equal(result.checksumConsistent, true);
  assert.equal(result.safeToTransferMoney, false);
  assert.equal(result.independentlyAuthenticated, false);
  assert.equal(result.settlementAllowed, false);
});

test("exact packet checksum remains deterministic with same worklist and timestamp", () => {
  const one = make({ codes: ["ADJUSTMENT_RESERVED_BALANCE_MISMATCH"] });
  const two = make({ codes: ["ADJUSTMENT_RESERVED_BALANCE_MISMATCH"] });
  assert.equal(one.checksumSha256, two.checksumSha256);
  assert.equal(one.checksumSha256, digestCore(one));
  assert.match(one.checksumSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(JSON.parse(JSON.stringify(one)), one);
  assert.equal(verifyDemoHybridFinanceReviewPacket(JSON.parse(JSON.stringify(one)))
    .checksumSha256, one.checksumSha256);
});

test("one changed cent, removed item or edited timestamp breaks checksum", () => {
  const packet = make({ counts: { hybridBillingAdjustments: 2 } });
  for (const mutate of [
    p => { p.worklist.counts.hybridBillingAdjustments = 3; },
    p => { p.worklist.items.pop(); },
    p => { p.generatedAt = "2026-10-25T12:34:56.000Z"; },
    p => { p.worklist.items[0].actionTH = "อนุมัติได้"; },
  ]) {
    const bad = copy(packet);
    mutate(bad);
    assert.throws(() => verifyDemoHybridFinanceReviewPacket(bad),
      /HYBRID_PACKET_/);
  }
});

test("recalculated checksum still cannot legitimize a forged SETTLED or unsigned bank approval", () => {
  const packet = make();
  for (const field of ["bankPaymentConfirmed", "settlementAllowed",
    "releaseReady", "digitallySigned", "bankSourceAuthenticated",
    "historicalBankCoverageVerified"]) {
    const bad = copy(packet);
    bad[field] = true;
    bad.checksumSha256 = digestCore(bad);
    assert.throws(() => verifyDemoHybridFinanceReviewPacket(bad),
      /HYBRID_PACKET_SHAPE_OR_SAFETY_INVALID/);
  }
});

test("recalculated checksum cannot hide forged finance action text or bank account string", () => {
  const packet = make({ codes: ["CANDIDATE_AMOUNT_MISMATCH"] });
  for (const change of [
    p => { p.worklist.items[0].actionTH = "Refund sent 123-456-7890"; },
    p => { p.worklist.items[4].code = "<bank-account-1234567890>"; },
    p => { p.worklist.items[4].resolved = true; },
    p => { p.worklist.items[4].evidenceVerified = true; },
    p => { p.worklist.counts["rawBankAccount"] = "1234567890"; },
  ]) {
    const bad = copy(packet);
    change(bad);
    bad.checksumSha256 = digestCore(bad);
    assert.throws(() => verifyDemoHybridFinanceReviewPacket(bad),
      /HYBRID_PACKET_/);
  }
});

test("redacted unknown integrity issues are not echoed even in JSON packet", () => {
  const packet = make({ codes: ["<account>123-456-7890 SECRET REF</account>"] });
  assert.equal(packet.worklist.unknownIntegrityCodeCount, 1);
  assert.equal(packet.worklist.items.at(-1).code, "UNKNOWN_INTEGRITY_CODE");
  const body = JSON.stringify(packet);
  assert.equal(body.includes("123-456-7890"), false);
  assert.equal(body.includes("SECRET REF"), false);
  assert.equal(verifyDemoHybridFinanceReviewPacket(packet).checksumConsistent, true);
});

test("noncanonical timestamps and extra arbitrary document fields are forbidden", () => {
  assert.throws(() => createDemoHybridFinanceReviewPacket(fixture(), {
    generatedAt: "2026-10-24",
  }), /TIMESTAMP_INVALID/);
  assert.throws(() => createDemoHybridFinanceReviewPacket(fixture(), {
    generatedAt: "2026-02-30T12:00:00.000Z",
  }), /TIMESTAMP_INVALID/);
  const packet = make();
  const bad = { ...packet, payoutAccount: "1234567890" };
  assert.throws(() => verifyDemoHybridFinanceReviewPacket(bad), /SHAPE_OR_SAFETY_INVALID/);
  const incorrectProject = { ...packet, projectId: "production-live" };
  assert.throws(() => verifyDemoHybridFinanceReviewPacket(incorrectProject), /SHAPE_OR_SAFETY_INVALID/);
});

test("review packet never mutates its source finance worklist", () => {
  const worklist = fixture({ codes: ["ADJUSTMENT_BALANCE_ORPHAN"] });
  const before = copy(worklist);
  const packet = createDemoHybridFinanceReviewPacket(worklist, {
    generatedAt: onDate,
  });
  assert.deepEqual(worklist, before);
  assert.equal(packet.worklist.settlementAllowed, false);
  assert.equal(packet.worklist.writesPerformed, false);
  assert.equal(packet.checksumIsBankAttestation, false);
});

test("offline verifier accepts a genuine packet's checksum but returns EXIT 2 (not settlement)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hybrid-packet-"));
  try {
    const filename = path.join(dir, "packet.json");
    fs.writeFileSync(filename, JSON.stringify(make()));
    const proc = spawnSync(process.execPath,
      ["tools/verify-hybrid-finance-packet.mjs", filename], {
        cwd: process.cwd(), encoding: "utf8", timeout: 5000,
        env: { ...process.env, GCLOUD_PROJECT: "production-live",
          FIRESTORE_EMULATOR_HOST: "", HYBRID_FINANCE_AUDIT_DEMO_ACK: "" },
      });
    assert.equal(proc.status, 2, proc.stderr);
    const out = JSON.parse(proc.stdout);
    assert.equal(out.status, "checksum_consistent_only");
    assert.equal(out.independentlyAuthenticated, false);
    assert.equal(out.releaseReady, false);
    assert.equal(out.settlementAllowed, false);
    assert.equal(out.bankPaymentConfirmed, false);
    const bad = copy(make());
    bad.worklist.counts.hybridBillingInvoices = 2;
    fs.writeFileSync(filename, JSON.stringify(bad));
    const denied = spawnSync(process.execPath,
      ["tools/verify-hybrid-finance-packet.mjs", filename], {
        cwd: process.cwd(), encoding: "utf8", timeout: 5000,
      });
    assert.notEqual(denied.status, 2,
      "Tampered packet must fail differently from expected blocked-review exit 2");
    assert.match(denied.stderr, /HYBRID_PACKET_/);
    assert.equal(denied.stdout.trim(), "");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI supports packet export while remaining emulator-gated and never reporting payout", () => {
  const cli = fs.readFileSync("tools/audit-hybrid-finance-demo.mjs", "utf8");
  const verify = fs.readFileSync("tools/verify-hybrid-finance-packet.mjs", "utf8");
  assert.match(cli, /format=text\|json\|packet/);
  assert.match(cli, /createDemoHybridFinanceReviewPacket\(worklist\)/);
  assert.match(cli, /assertDemoEnvironment\(process\.env\)/);
  assert.match(cli, /process\.exitCode = 2/);
  assert.match(verify, /verifyDemoHybridFinanceReviewPacket\(input\)/);
  assert.match(verify, /process\.exitCode = 2/);
  assert.doesNotMatch(cli + verify, /onCall\(|onSchedule\(|tx\.update\(|tx\.create\(/);
});

test("review packet is not registered in any Production Cloud Function", () => {
  const prod = fs.readFileSync("functions/index.js", "utf8")
    + fs.readFileSync("functions/bootstrap.js", "utf8");
  assert.doesNotMatch(prod, /hybrid-billing-finance-review-packet|verify-hybrid-finance-packet/);
});
