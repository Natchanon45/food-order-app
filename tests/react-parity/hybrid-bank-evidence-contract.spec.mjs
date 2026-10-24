import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { canonicalHybridBankEvidenceBytes, verifyHybridSignedBankEvidencePreflight } =
  require("../../functions/hybrid-billing-bank-evidence-contract.js");

// All signing keys are generated at test runtime, never committed.
// These are synthetic keys and DO NOT represent a real bank.
const keys = generateKeyPairSync("ed25519");
const keyPem = keys.publicKey.export({ type: "spki", format: "pem" });
const providerId = "sandbox_bank";
const keyId = "sandbox_signer_2026";
const asOf = "2026-10-24T12:00:00.000Z";
const payload = {
  tenantId: "demo-shop", invoiceId: "2026-10-24:monthly:fixed",
  adjustmentId: "adjustment_12345678901234",
  instructionHash: "a".repeat(64),
  bankReferenceHash: "b".repeat(64),
  destinationFingerprint: "c".repeat(64),
  amountCents: 25000, currency: "THB", direction: "debit",
  postingStatus: "posted",
  submittedAt: "2026-10-24T09:00:00.000Z",
  postedAt: "2026-10-24T10:00:00.000Z",
};
const expected = Object.fromEntries(
  ["tenantId", "invoiceId", "adjustmentId", "instructionHash",
    "bankReferenceHash", "destinationFingerprint", "amountCents"]
    .map(k => [k, payload[k]]),
);
const registry = { [providerId]: { [keyId]: {
  enabled: true, publicKeyPem: keyPem,
} } };
const envelope = (p = payload, fields = {}) => {
  const bare = {
    version: "hybrid_bank_posting_ed25519_v1",
    providerId, keyId, payload: p, ...fields,
  };
  return { ...bare, signatureBase64: sign(null,
    canonicalHybridBankEvidenceBytes(bare), keys.privateKey).toString("base64") };
};
const run = (e, opts = {}) => verifyHybridSignedBankEvidencePreflight({
  envelope: e, trustedRegistry: registry, expected, expectedProviderId: providerId,
  asOf, ...opts,
});

test("Ed25519 verifies a synthetic signed record but NEVER authenticates a bank or settlement", () => {
  const e = envelope();
  const result = run(e);
  assert.equal(result.signatureCryptographicallyValid, true);
  assert.equal(result.payloadScopeMatched, true);
  assert.equal(result.bankProviderIdentityIndependentlyAuthenticated, false);
  assert.equal(result.realBankStatementSourceIntegrated, false);
  assert.equal(result.historicalPayoutsVerified, false);
  assert.equal(result.settlementAllowed, false);
  assert.equal(result.settlementConfirmed, false);
  assert.equal(result.writesPerformed, false);
  assert.equal(result.releaseReady, false);
  assert.match(result.evidenceContentSha256, /^[a-f0-9]{64}$/);
  for (const raw of [e.signatureBase64, payload.invoiceId,
    payload.adjustmentId, payload.tenantId, keyPem, payload.bankReferenceHash]) {
    assert.equal(JSON.stringify(result).includes(raw), false);
  }
});

test("substituted amount, original invoice, recipient or bank reference fails before approval", () => {
  const e = envelope();
  for (const field of ["amountCents", "invoiceId", "tenantId",
    "instructionHash", "bankReferenceHash", "destinationFingerprint"]) {
    const value = field === "amountCents" ? 26000
      : ["invoiceId", "tenantId"].includes(field) ? "other-shop"
        : "d".repeat(64);
    const expectedChanged = { ...expected, [field]: value };
    assert.throws(() => run(e, { expected: expectedChanged }),
      /HYBRID_BANK_EVIDENCE_SCOPE_AMOUNT_OR_REFERENCE_MISMATCH/);
  }
});

test("editing any signed field without resigning destroys signature", () => {
  const e = envelope();
  for (const changed of [
    { payload: { ...payload, amountCents: 25001 } },
    { payload: { ...payload, postedAt: "2026-10-24T11:00:00.000Z" } },
    { providerId: "different_bank" },
    { keyId: "other_signer_2026" },
  ]) {
    const forged = { ...e, ...changed };
    assert.throws(() => run(forged), /HYBRID_BANK_EVIDENCE_/);
  }
});

test("unrecognized, revoked or browser-injected key cannot verify", () => {
  const e = envelope();
  assert.throws(() => run(e, { trustedRegistry: {} }), /TRUSTED_SERVER_KEY_REQUIRED/);
  assert.throws(() => run(e, {
    trustedRegistry: { [providerId]: { [keyId]: {
      enabled: false, publicKeyPem: keyPem,
    } } },
  }), /TRUSTED_SERVER_KEY_REQUIRED/);
  assert.throws(() => run({ ...e, publicKeyPem: keyPem }),
    /ENVELOPE_OR_PROVIDER_INVALID/);
  assert.throws(() => run(e, { expectedProviderId: "different_bank" }),
    /ENVELOPE_OR_PROVIDER_INVALID/);
});

test("a cryptographically valid signature using an OTHER key is rejected", () => {
  const second = generateKeyPairSync("ed25519");
  const body = canonicalHybridBankEvidenceBytes({
    version: "hybrid_bank_posting_ed25519_v1", providerId, keyId, payload,
  });
  const wrong = { ...envelope(), signatureBase64: sign(null,
    body, second.privateKey).toString("base64") };
  assert.throws(() => run(wrong), /SIGNATURE_VERIFICATION_FAILED/);
});

test("mismatched currency, direction, pending posting and unsorted times fail", () => {
  for (const field of [
    { currency: "USD" },
    { direction: "credit" },
    { postingStatus: "pending" },
    { submittedAt: "2026-10-24T11:00:00.000Z" },
    { postedAt: "2026-10-24T08:00:00.000Z" },
  ]) {
    assert.throws(() => envelope({ ...payload, ...field }),
      /HYBRID_BANK_EVIDENCE_INVALID_CANONICAL_PAYLOAD/);
  }
  const future = envelope({ ...payload,
    postedAt: "2026-10-24T14:00:00.000Z" });
  assert.throws(() => run(future),
    /HYBRID_BANK_EVIDENCE_POSTED_AFTER_OBSERVATION/);
});

test("extra keys, raw account numbers or preapproved flags are forbidden", () => {
  for (const field of [
    { rawBankAccount: "1234567890" }, { settlementAllowed: true },
    { signatureVerified: true }, { liveBankAuthenticated: true },
    { instructionId: "raw_outgoing_123456" },
  ]) {
    const unsigned = {
      version: "hybrid_bank_posting_ed25519_v1", providerId, keyId,
      payload: { ...payload, ...field },
    };
    assert.throws(() => canonicalHybridBankEvidenceBytes(unsigned),
      /INVALID_CANONICAL_PAYLOAD/);
  }
  assert.throws(() => run({ ...envelope(), bankReceipt: "raw" }),
    /ENVELOPE_OR_PROVIDER_INVALID/);
});

test("missing/malformed signature and wrong key algorithm must fail closed", () => {
  const e = envelope();
  for (const signatureBase64 of [
    "", "not-base64", e.signatureBase64.slice(0, -1) + "A",
  ]) assert.throws(() => run({ ...e, signatureBase64 }),
    /HYBRID_BANK_EVIDENCE_/);
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
  assert.throws(() => run(e, {
    trustedRegistry: { [providerId]: { [keyId]: {
      enabled: true, publicKeyPem: rsa.publicKey.export({
        type: "spki", format: "pem",
      }),
    } } },
  }), /ED25519_PUBLIC_KEY_REQUIRED/);
});

test("invalid future, noncanonical date or zero/unsafe baht amount fails", () => {
  const e = envelope();
  for (const badTime of ["2026-10-24", "2026-02-30T12:00:00.000Z",
    "2026-10-24T12:00:00+07:00"]) {
    assert.throws(() => run(e, { asOf: badTime }), /TRUSTED_SCOPE_REQUIRED/);
  }
  for (const amountCents of [0, -1, 1.5, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => canonicalHybridBankEvidenceBytes({
      version: "hybrid_bank_posting_ed25519_v1", providerId, keyId,
      payload: { ...payload, amountCents },
    }), /INVALID_CANONICAL_PAYLOAD/);
  }
});

test("cryptographic preflight cannot write Firebase, transfer money or grant production approval", () => {
  const source = fs.readFileSync("functions/hybrid-billing-bank-evidence-contract.js", "utf8");
  const production = fs.readFileSync("functions/index.js", "utf8")
    + fs.readFileSync("functions/bootstrap.js", "utf8");
  assert.doesNotMatch(source, /onCall\(|onSchedule\(|runTransaction\(|tx\.create\(|tx\.update\(|uploadBytes\(|https\.onRequest|fetch\(/);
  assert.doesNotMatch(production, /hybrid-billing-bank-evidence-contract/);
  assert.match(source, /bankProviderIdentityIndependentlyAuthenticated: false/);
  assert.match(source, /settlementAllowed: false/);
  assert.match(source, /realBankStatementSourceIntegrated: false/);
});
