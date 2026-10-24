import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { preflightHybridSignedBankEvidenceBatch } =
  require("../../functions/hybrid-billing-bank-batch-preflight.js");
const { canonicalHybridBankEvidenceBytes } =
  require("../../functions/hybrid-billing-bank-evidence-contract.js");

// All keys and postings are synthetic and generated at test runtime.
const keys = generateKeyPairSync("ed25519");
const providerId = "sandbox_bank";
const keyId = "synthetic_key_2026";
const hash = text => createHash("sha256").update(text).digest("hex");
const registry = { [providerId]: { [keyId]: {
  enabled: true,
  publicKeyPem: keys.publicKey.export({ type: "spki", format: "pem" }),
  fingerprintSha256: hash(keys.publicKey.export({ type: "spki", format: "der" })),
  validFrom: "2026-10-01T00:00:00.000Z",
  validUntil: "2026-11-30T23:59:59.000Z",
  revokedAt: null, registeredBy: "security-registrar",
  reviewedBy: "finance-reviewer",
} } };
const asOf = "2026-10-24T12:00:00.000Z";
const SCOPE = ["tenantId", "invoiceId", "adjustmentId", "instructionHash",
  "bankReferenceHash", "destinationFingerprint", "amountCents"];
const item = (n, values = {}) => {
  const payload = {
    tenantId: "tenant_demo",
    invoiceId: "2026-10-24:monthly:fixed",
    adjustmentId: "adjustment_" + String(n).padStart(16, "0"),
    instructionHash: hash("outgoing-" + n),
    bankReferenceHash: hash("posting-" + n),
    destinationFingerprint: hash("beneficiary-" + n),
    amountCents: 25000 + n,
    currency: "THB", direction: "debit", postingStatus: "posted",
    submittedAt: "2026-10-24T09:00:00.000Z",
    postedAt: "2026-10-24T10:00:00.000Z",
    ...values,
  };
  const bare = { version: "hybrid_bank_posting_ed25519_v1",
    providerId, keyId, payload };
  const envelope = { ...bare, signatureBase64: sign(null,
    canonicalHybridBankEvidenceBytes(bare), keys.privateKey).toString("base64") };
  const expected = Object.fromEntries(SCOPE.map(name => [name, payload[name]]));
  return { envelope, expected };
};
const run = (postings, extra = {}) => preflightHybridSignedBankEvidenceBatch({
  postings, trustedRegistry: registry, expectedProviderId: providerId,
  asOf, ...extra,
});
const reject = (postings, code) =>
  assert.throws(() => run(postings), new RegExp("HYBRID_BANK_BATCH_" + code));

test("valid synthetic batch verifies all signatures, yet never authorizes money", () => {
  const result = run([item(1), item(2)]);
  assert.equal(result.postingsChecked, 2);
  assert.equal(result.uniqueBankReferences, 2);
  assert.equal(result.uniqueOutgoingInstructions, 2);
  assert.equal(result.uniqueTenantAdjustments, 2);
  assert.equal(result.bankProviderIdentityIndependentlyAuthenticated, false);
  assert.equal(result.realBankStatementSourceIntegrated, false);
  assert.equal(result.globalHistoricalReplayChecked, false);
  assert.equal(result.historicalPayoutsVerified, false);
  assert.equal(result.settlementConfirmed, false);
  assert.equal(result.settlementAllowed, false);
  assert.equal(result.releaseReady, false);
  assert.equal(result.writesPerformed, false);
  assert.match(result.batchContentSha256, /^[a-f0-9]{64}$/);
  const serialized = JSON.stringify(result);
  for (const raw of [item(1).expected.adjustmentId, item(1).expected.tenantId,
    item(1).expected.bankReferenceHash, registry[providerId][keyId].publicKeyPem]) {
    assert.equal(serialized.includes(raw), false);
  }
});

test("order-independent diagnostic content checksum, with scope-bound content", () => {
  assert.equal(run([item(1), item(2)]).batchContentSha256,
    run([item(2), item(1)]).batchContentSha256);
  assert.notEqual(run([item(1), item(2)]).batchContentSha256,
    run([item(1), item(3)]).batchContentSha256);
});

test("duplicate bank references fail even across different tenants", () => {
  const first = item(1);
  const second = item(2, {
    tenantId: "other_tenant",
    bankReferenceHash: first.expected.bankReferenceHash,
  });
  reject([first, second], "REPEATED_BANK_REFERENCE");
});

test("same outgoing instruction cannot appear twice in a batch", () => {
  const first = item(1);
  const second = item(2, {
    instructionHash: first.expected.instructionHash,
  });
  reject([first, second], "REPEATED_OUTGOING_INSTRUCTION");
});

test("same tenant+adjustment cannot claim multiple bank postings", () => {
  const first = item(1);
  const second = item(2, {
    adjustmentId: first.expected.adjustmentId,
  });
  reject([first, second], "REPEATED_TENANT_ADJUSTMENT");
});

test("one tampered signature or expected scope rejects the ENTIRE batch", () => {
  const signed = item(2);
  const tampered = {
    ...signed,
    envelope: { ...signed.envelope,
      payload: { ...signed.envelope.payload, amountCents: 999999 } },
  };
  reject([item(1), tampered], "ITEM_REJECTED");
  const wrongScope = { ...signed, expected: {
    ...signed.expected, destinationFingerprint: hash("different-recipient"),
  } };
  reject([item(1), wrongScope], "ITEM_REJECTED");
});

test("unknown, disabled or revoked signing keys fail closed", () => {
  const baseline = item(1);
  for (const config of [{},
    { [providerId]: { [keyId]: {
      ...registry[providerId][keyId], enabled: false,
    } } },
    { [providerId]: { [keyId]: {
      ...registry[providerId][keyId], revokedAt: asOf,
    } } },
  ]) {
    assert.throws(() => run([baseline], { trustedRegistry: config }),
      /HYBRID_BANK_BATCH_ITEM_REJECTED/);
  }
});

test("reject extra bank authorization fields and unsafe top-level input", () => {
  const valid = item(1);
  reject([{ ...valid, settlementAllowed: true }], "ITEM_FIELDS_INVALID");
  assert.throws(() => run([valid], { bankAuthenticated: true }),
    /HYBRID_BANK_BATCH_INPUT_OR_SIZE_INVALID/);
  reject([{ ...valid, envelope: {
    ...valid.envelope, bankAccountNumber: "1234567890",
  } }], "ITEM_REJECTED");
});

test("strict bounded input rejects zero or over 100 records", () => {
  reject([], "INPUT_OR_SIZE_INVALID");
  assert.throws(() => run(Array.from({ length: 101 }, (_, i) => item(i + 1))),
    /HYBRID_BANK_BATCH_INPUT_OR_SIZE_INVALID/);
  assert.throws(() => preflightHybridSignedBankEvidenceBatch({}),
    /HYBRID_BANK_BATCH_INPUT_OR_SIZE_INVALID/);
});

test("private batch helper is read-only and not exported by Production functions", () => {
  const src = fs.readFileSync("functions/hybrid-billing-bank-batch-preflight.js", "utf8");
  const production = fs.readFileSync("functions/index.js", "utf8")
    + fs.readFileSync("functions/bootstrap.js", "utf8");
  assert.doesNotMatch(src,
    /firebase-admin|onCall\(|onSchedule\(|runTransaction\(|tx\.create\(|tx\.update\(|fetch\(|https\.onRequest/);
  assert.doesNotMatch(production, /hybrid-billing-bank-batch-preflight/);
  for (const condition of ["bankProviderIdentityIndependentlyAuthenticated: false",
    "realBankStatementSourceIntegrated: false", "globalHistoricalReplayChecked: false",
    "settlementAllowed: false", "writesPerformed: false"]) {
    assert.ok(src.includes(condition), condition);
  }
});
