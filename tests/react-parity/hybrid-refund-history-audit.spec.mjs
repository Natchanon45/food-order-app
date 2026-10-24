import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { auditDemoHybridRefundHistory } =
  require("../../functions/hybrid-billing-refund-history-audit.js");

const tenantId = "demo-shop", adjustmentId = "adjustment_12345678901234";
const invoiceId = "2026-10-24:monthly:fixed";
const bankReferenceHash = "a".repeat(64), instructionHash = "b".repeat(64);
const candidate = {
  id: adjustmentId, tenantId, invoiceId,
  invoiceSignature: "f".repeat(64), observedBy: "super-auditor",
  bankReferenceHash, instructionHash, amount: 250,
  state: "awaiting_independent_bank_attestation",
  settlementConfirmed: false, sourceIntegrationReady: false,
};
const referenceClaim = { bankReferenceHash, tenantId, adjustmentId,
  invoiceId, state: "unverified_candidate" };
const instructionClaim = { instructionHash, tenantId, adjustmentId,
  invoiceId, state: "unverified_candidate" };
const signature = "f".repeat(64);
const invoice = { id: invoiceId, tenantId, status: "paid", version: "hybrid-invoice-v1",
  signature, amount: 590 };
const adjustment = { id: adjustmentId, tenantId, invoiceId, invoiceSignature: signature,
  kind: "refund_request", amount: 250, amountCents: 25000,
  status: "approved", externallySettled: false, proposedBy: "super-proposer",
  reviewedBy: "super-reviewer" };
const reviewEvent = { tenantId, invoiceId, adjustmentId, invoiceSignature: signature,
  resultStatus: "approved", action: "approve", reviewerId: "super-reviewer",
  externallySettled: false };
const balance = { tenantId, invoiceId, invoiceSignature: signature,
  invoiceAmountCents: 59000, reservedCents: 25000, count: 1 };

function fixture({ rows = {}, projectId = "demo-penguin-hybrid",
  host = "127.0.0.1:8080" } = {}) {
  const counts = [], mock = name => ({
    limit: n => {
      counts.push({ name, limit: n });
      return {
        get: async () => ({ docs: (rows[name] || []).slice(0, n).map(([id, body, path]) => ({
          id, ref: { path: path || (name.startsWith("hybridRefund")
            || name === "financeSlipClaims" ? name + "/" + id
              : "tenants/" + (body.tenantId || tenantId) + "/" + name + "/" + id) },
          data: () => body,
        })) }),
      };
    },
  });
  const db = { app: { options: { projectId } },
    collection: mock, collectionGroup: mock };
  const oldHost = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = host;
  return { db, counts, restore: () => {
    if (oldHost === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = oldHost;
  } };
}
async function scenario(fn, options) {
  const e = fixture(options);
  try { return await fn(e); } finally { e.restore(); }
}
const validRows = () => ({
  hybridBillingRefundCandidates: [[adjustmentId, candidate,
    "tenants/" + tenantId + "/hybridBillingRefundCandidates/" + adjustmentId]],
  hybridRefundReferenceClaims: [[bankReferenceHash, referenceClaim]],
  hybridRefundInstructionClaims: [[instructionHash, instructionClaim]],
  hybridBillingInvoices: [[invoiceId, invoice]],
  hybridBillingAdjustments: [[adjustmentId, adjustment]],
  hybridBillingAdjustmentEvents: [[adjustmentId + "-review", reviewEvent]],
  hybridBillingAdjustmentBalances: [[invoiceId, balance]],
});

test("empty historical database NEVER certifies bank settlement or legacy completeness", async () =>
  scenario(async ({ db, counts }) => {
    const report = await auditDemoHybridRefundHistory({ db });
    assert.equal(report.releaseReady, false);
    assert.equal(report.settlementAllowed, false);
    assert.equal(report.historicalBankCoverageVerified, false);
    assert.equal(report.bankSourceAuthenticated, false);
    assert.equal(report.atomicSnapshot, false);
    assert.equal(report.writesPerformed, false);
    assert.equal(report.integrityIssueCount, 0);
    assert.equal(report.sourcesScanned.length, 12);
    assert.equal(counts.length, 12);
    assert.deepEqual([...new Set(counts.map(x => x.limit))], [101]);
    assert.ok(report.blockers.includes("LEGACY_OUTGOING_BANK_REFUNDS_NOT_MIGRATED"));
  }));

test("consistent synthetic candidate+both global claims still blocks real bank settlement", async () =>
  scenario(async ({ db }) => {
    const report = await auditDemoHybridRefundHistory({ db });
    assert.equal(report.integrityIssueCount, 0);
    assert.equal(report.counts.hybridBillingRefundCandidates, 1);
    assert.equal(report.counts.hybridRefundReferenceClaims, 1);
    assert.equal(report.counts.hybridRefundInstructionClaims, 1);
    assert.equal(report.settlementAllowed, false);
  }, { rows: validRows() }));

test("missing bank claim is reported, never auto-backfilled or treated as approval", async () =>
  scenario(async ({ db }) => {
    const rows = validRows();
    rows.hybridRefundReferenceClaims = [];
    // Separate fixture below supplies rows so this callback only asserts report.
    const out = await auditDemoHybridRefundHistory({ db });
    assert.ok(out.blockers.includes("BANK_REFERENCE_INDEX_INCOMPLETE"));
    assert.equal(out.releaseReady, false);
  }, { rows: { ...validRows(), hybridRefundReferenceClaims: [] } }));

test("missing outgoing instruction claim and orphan records are integrity blockers", async () =>
  scenario(async ({ db }) => {
    const out = await auditDemoHybridRefundHistory({ db });
    assert.ok(out.blockers.includes("OUTGOING_INSTRUCTION_INDEX_INCOMPLETE"));
    assert.ok(out.blockers.includes("BANK_REFERENCE_ORPHAN_OR_CONFLICT"));
    assert.equal(out.settlementAllowed, false);
  }, { rows: {
    ...validRows(),
    hybridRefundInstructionClaims: [],
    hybridRefundReferenceClaims: [
      [bankReferenceHash, referenceClaim],
      ["c".repeat(64), { ...referenceClaim, bankReferenceHash: "c".repeat(64) }],
    ],
  } }));

test("false settled flag in demo candidate triggers investigation, not a payout confirmation", async () =>
  scenario(async ({ db }) => {
    const out = await auditDemoHybridRefundHistory({ db });
    assert.ok(out.blockers.includes("CANDIDATE_UNTRUSTED_SETTLEMENT_FLAG"));
    assert.equal(out.settlementAllowed, false);
  }, { rows: { ...validRows(), hybridBillingRefundCandidates: [
    [adjustmentId, { ...candidate, settlementConfirmed: true },
      "tenants/" + tenantId + "/hybridBillingRefundCandidates/" + adjustmentId],
  ] } }));

test("wallet delivery-refund credits are counted separately, not as outgoing bank refunds", async () =>
  scenario(async ({ db }) => {
    const out = await auditDemoHybridRefundHistory({ db });
    assert.equal(out.counts.lalamoveWalletTransactions, 3);
    assert.equal(out.counts.lalamoveWalletDeliveryRefundCredits, 1);
    assert.equal(out.bankSourceAuthenticated, false);
    assert.equal(out.historicalBankCoverageVerified, false);
  }, { rows: {
    lalamoveWalletTransactions: [
      ["ledger-1", { type: "delivery_refund", direction: "credit" }],
      ["ledger-2", { type: "topup", direction: "credit" }],
      ["ledger-3", { type: "delivery_debit", direction: "debit" }],
    ],
  } }));

test("query bound overflow fails closed instead of claiming all historical records read", async () =>
  scenario(async ({ db }) => {
    await assert.rejects(auditDemoHybridRefundHistory({ db, maxPerSource: 2 }),
      /HYBRID_REFUND_HISTORY_LIMIT_/);
  }, { rows: { financeSlipClaims: [
    ["bank1", {}], ["bank2", {}], ["bank3", {}],
  ] } }));

test("wrong Firebase project or remote/missing Emulator host refuses ALL read queries", async () => {
  for (const options of [
    { projectId: "live-project" },
    { host: "firestore.example.com:8080" }, { host: "" },
  ]) await scenario(async ({ db, counts }) => {
    await assert.rejects(auditDemoHybridRefundHistory({ db }),
      /HYBRID_REFUND_HISTORY_DEMO_ONLY/);
    assert.equal(counts.length, 0);
  }, options);
});

test("unsupported limit and untrusted document identity fail closed", async () =>
  scenario(async ({ db }) => {
    for (const maxPerSource of [0, 501, 2.5, "100"]) {
      await assert.rejects(auditDemoHybridRefundHistory({ db, maxPerSource }),
        /SCAN_LIMIT_INVALID/);
    }
    const out = await auditDemoHybridRefundHistory({ db });
    assert.ok(out.blockers.includes("CANDIDATE_IDENTITY_OR_SCOPE_INVALID"));
    assert.equal(out.settlementAllowed, false);
  }, { rows: { hybridBillingRefundCandidates: [
    [adjustmentId, candidate, "tenants/other-tenant/hybridBillingRefundCandidates/" + adjustmentId],
  ] } }));

test("privacy: diagnostic outputs counts and issue codes, not bank/user/source records", async () =>
  scenario(async ({ db }) => {
    const out = await auditDemoHybridRefundHistory({ db });
    const serialized = JSON.stringify(out);
    for (const secret of [invoiceId, adjustmentId, bankReferenceHash,
      instructionHash, tenantId, "bank-account-1234567890"]) {
      assert.equal(serialized.includes(secret), false);
    }
    assert.equal(Object.hasOwn(out, "documents"), false);
    assert.equal(Object.hasOwn(out, "bankReferenceHashes"), false);
  }, { rows: validRows() }));

test("audit chain detects missing paid invoice or forged signature", async () => {
  for (const rows of [
    { ...validRows(), hybridBillingInvoices: [] },
    { ...validRows(), hybridBillingInvoices: [[invoiceId, { ...invoice, signature: "a".repeat(64) }]] },
  ]) await scenario(async ({ db }) => {
    const report = await auditDemoHybridRefundHistory({ db });
    assert.ok(report.integrityIssueCodes.includes("CANDIDATE_PAID_INVOICE_PROVENANCE_MISSING"));
    assert.equal(report.settlementAllowed, false);
  }, { rows });
});

test("audit chain blocks absent approved adjustment and independent finance decision", async () => {
  for (const [change, code] of [
    [{ hybridBillingAdjustments: [] }, "CANDIDATE_APPROVED_ADJUSTMENT_MISSING"],
    [{ hybridBillingAdjustmentEvents: [] }, "CANDIDATE_INDEPENDENT_REVIEW_MISSING"],
    [{ hybridBillingAdjustmentEvents: [[adjustmentId + "-review",
      { ...reviewEvent, reviewerId: "super-proposer" }]] }, "CANDIDATE_INDEPENDENT_REVIEW_MISSING"],
  ]) await scenario(async ({ db }) => {
    const r = await auditDemoHybridRefundHistory({ db });
    assert.ok(r.integrityIssueCodes.includes(code));
  }, { rows: { ...validRows(), ...change } });
});

test("audit chain requires three distinct finance actors and exact amounts", async () => {
  const variants = [
    [{ hybridBillingRefundCandidates: [[adjustmentId,
      { ...candidate, observedBy: "super-reviewer" }]] }, "CANDIDATE_SEPARATION_OF_DUTIES_MISSING"],
    [{ hybridBillingRefundCandidates: [[adjustmentId,
      { ...candidate, amount: 251 }]] }, "CANDIDATE_AMOUNT_MISMATCH"],
    [{ hybridBillingAdjustments: [[adjustmentId,
      { ...adjustment, amountCents: 25001 }]] }, "CANDIDATE_AMOUNT_MISMATCH"],
  ];
  for (const [change, issue] of variants) {
    const docRows = { ...validRows(), ...change };
    if (change.hybridBillingRefundCandidates) {
      docRows.hybridBillingRefundCandidates = change.hybridBillingRefundCandidates.map(
        ([id, body]) => [id, body,
          "tenants/" + tenantId + "/hybridBillingRefundCandidates/" + id]);
    }
    await scenario(async ({ db }) => {
      const r = await auditDemoHybridRefundHistory({ db });
      assert.ok(r.integrityIssueCodes.includes(issue));
      assert.equal(r.releaseReady, false);
    }, { rows: docRows });
  }
});

test("cap reconciliation detects insufficient reservation, orphan cap and duplicate spend", async () => {
  for (const [rows, issue] of [
    [{ ...validRows(), hybridBillingAdjustmentBalances: [] },
      "ADJUSTMENT_RESERVED_BALANCE_MISMATCH"],
    [{ ...validRows(), hybridBillingAdjustmentBalances: [[invoiceId,
      { ...balance, reservedCents: 24900 }]] }, "ADJUSTMENT_RESERVED_BALANCE_MISMATCH"],
    [{ ...validRows(), hybridBillingAdjustmentBalances: [[invoiceId, balance],
      ["2026-10-25:monthly:fixed", { ...balance,
        invoiceId: "2026-10-25:monthly:fixed" }]] }, "ADJUSTMENT_BALANCE_ORPHAN"],
  ]) await scenario(async ({ db }) => {
    const r = await auditDemoHybridRefundHistory({ db });
    assert.ok(r.integrityIssueCodes.includes(issue));
  }, { rows });
});

test("review events are not allowed without matching adjustment identity", async () =>
  scenario(async ({ db }) => {
    const r = await auditDemoHybridRefundHistory({ db });
    assert.ok(r.integrityIssueCodes.includes("ADJUSTMENT_REVIEW_EVENT_ORPHAN"));
    assert.equal(r.settlementAllowed, false);
  }, { rows: { ...validRows(), hybridBillingAdjustmentEvents: [
    [adjustmentId + "-review", reviewEvent],
    ["other_adjustment_123456-review", { ...reviewEvent, adjustmentId: "other_adjustment_123456" }],
  ] } }));

test("private history scanner is unexposed and side-effect-free", () => {
  const src = fs.readFileSync("functions/hybrid-billing-refund-history-audit.js", "utf8");
  const prod = fs.readFileSync("functions/index.js", "utf8")
    + fs.readFileSync("functions/bootstrap.js", "utf8");
  assert.doesNotMatch(prod, /hybrid-billing-refund-history-audit/);
  assert.doesNotMatch(src, /onCall\(|onSchedule\(|tx\.create\(|tx\.set\(|tx\.update\(|batch\.commit\(|\.runTransaction\(/);
  assert.match(src, /settlementAllowed: false/);
  assert.match(src, /historicalBankCoverageVerified: false/);
  assert.match(src, /return Object\.freeze\(/);
});
