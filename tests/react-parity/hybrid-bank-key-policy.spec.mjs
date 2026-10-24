import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { validateHybridBankPinnedKey } =
  require("../../functions/hybrid-billing-bank-key-policy.js");
const { canonicalHybridBankEvidenceBytes, verifyHybridSignedBankEvidencePreflight } =
  require("../../functions/hybrid-billing-bank-evidence-contract.js");

const providerId = "sandbox_bank", keyId = "key_2026_oct";
const keys = generateKeyPairSync("ed25519");
const from = "2026-10-01T00:00:00.000Z";
const until = "2026-11-30T23:59:59.000Z";
const posted = "2026-10-24T10:00:00.000Z";
const checked = "2026-10-24T12:00:00.000Z";
const publicKeyPem = keys.publicKey.export({ type: "spki", format: "pem" });
const fingerprintSha256 = createHash("sha256")
  .update(keys.publicKey.export({ type: "spki", format: "der" })).digest("hex");

const entry = {
  enabled: true, publicKeyPem, fingerprintSha256,
  validFrom: from, validUntil: until, revokedAt: null,
  registeredBy: "finance-key-admin", reviewedBy: "security-key-reviewer",
};
const registry = { [providerId]: { [keyId]: entry } };
const args = { trustedRegistry: registry, providerId, keyId,
  postingAt: posted, checkedAt: checked };
const payload = {
  tenantId: "demo-shop", invoiceId: "2026-10-24:monthly:fixed",
  adjustmentId: "adjustment_12345678901234",
  instructionHash: "a".repeat(64), bankReferenceHash: "b".repeat(64),
  destinationFingerprint: "c".repeat(64), amountCents: 25000,
  currency: "THB", direction: "debit", postingStatus: "posted",
  submittedAt: "2026-10-24T09:00:00.000Z", postedAt: posted,
};
const expected = Object.fromEntries(
  ["tenantId", "invoiceId", "adjustmentId", "instructionHash",
    "bankReferenceHash", "destinationFingerprint", "amountCents"]
    .map(k => [k, payload[k]]),
);
const envelope = key => {
  const src = { version: "hybrid_bank_posting_ed25519_v1",
    providerId, keyId: key || keyId, payload };
  return { ...src, signatureBase64: sign(null,
    canonicalHybridBankEvidenceBytes(src), keys.privateKey).toString("base64") };
};

test("pinned Ed25519 SPKI fingerprint and two internal approvers verify only synthetic signature", () => {
  const key = validateHybridBankPinnedKey(args);
  assert.equal(key.asymmetricKeyType, "ed25519");
  const result = verifyHybridSignedBankEvidencePreflight({
    envelope: envelope(), trustedRegistry: registry, expected,
    expectedProviderId: providerId, asOf: checked,
  });
  assert.equal(result.signatureCryptographicallyValid, true);
  assert.equal(result.bankProviderIdentityIndependentlyAuthenticated, false);
  assert.equal(result.realBankStatementSourceIntegrated, false);
  assert.equal(result.settlementAllowed, false);
  assert.equal(result.writesPerformed, false);
});

test("pinning rejects tampered fingerprint even with a mathematically valid signature", () => {
  const bad = { ...entry, fingerprintSha256: "d".repeat(64) };
  assert.throws(() => validateHybridBankPinnedKey({
    ...args, trustedRegistry: { [providerId]: { [keyId]: bad } },
  }), /FINGERPRINT_MISMATCH/);
});

test("changing public key while keeping old pinned fingerprint fails", () => {
  const other = generateKeyPairSync("ed25519");
  assert.throws(() => validateHybridBankPinnedKey({
    ...args, trustedRegistry: { [providerId]: { [keyId]: {
      ...entry, publicKeyPem: other.publicKey.export({ type: "spki", format: "pem" }),
    } } },
  }), /FINGERPRINT_MISMATCH/);
});

test("registrar cannot be its own independent key reviewer", () => {
  const unreviewed = { ...entry, reviewedBy: entry.registeredBy };
  assert.throws(() => validateHybridBankPinnedKey({
    ...args, trustedRegistry: { [providerId]: { [keyId]: unreviewed } },
  }), /INVALID_CONFIGURATION/);
});

test("revocation and disabled keys refuse ALL postings including historical ones", () => {
  for (const changed of [
    { enabled: false },
    { revokedAt: "2026-10-24T11:00:00.000Z" },
    { revokedAt: "2026-10-25T00:00:00.000Z" },
  ]) {
    assert.throws(() => validateHybridBankPinnedKey({
      ...args, trustedRegistry: { [providerId]: { [keyId]: { ...entry, ...changed } } },
    }), /HYBRID_BANK_KEY_(DISABLED|REVOKED)/);
  }
});

test("posting or check outside approved interval fails closed, including post-expiry audits", () => {
  for (const override of [
    { postingAt: "2026-09-30T23:59:59.000Z" },
    { postingAt: "2026-12-01T00:00:00.000Z",
      checkedAt: "2026-12-01T00:00:01.000Z" },
    { checkedAt: "2026-12-01T00:00:00.000Z" },
    { checkedAt: "2026-10-24T09:59:59.000Z" },
  ]) {
    assert.throws(() => validateHybridBankPinnedKey({ ...args, ...override }),
      /OUTSIDE_VALIDITY_WINDOW/);
  }
});

test("reversed and forged time windows are forbidden", () => {
  for (const change of [
    { validFrom: until, validUntil: from },
    { validFrom: "2026-02-30T00:00:00.000Z" },
    { validUntil: "2026-12-01T00:00:00+07:00" },
    { revokedAt: "yesterday" },
  ]) assert.throws(() => validateHybridBankPinnedKey({
    ...args, trustedRegistry: { [providerId]: { [keyId]: { ...entry, ...change } } },
  }), /HYBRID_BANK_KEY_/);
});

test("extra origin-confirmed field and omitted fingerprint cannot claim trust", () => {
  for (const change of [
    { bankOriginConfirmed: true },
    { settlementAllowed: true },
    { sourceAuthenticated: true },
  ]) assert.throws(() => validateHybridBankPinnedKey({
    ...args, trustedRegistry: { [providerId]: { [keyId]: { ...entry, ...change } } },
  }), /INVALID_CONFIGURATION/);
  const missing = { ...entry };
  delete missing.fingerprintSha256;
  assert.throws(() => validateHybridBankPinnedKey({
    ...args, trustedRegistry: { [providerId]: { [keyId]: missing } },
  }), /INVALID_CONFIGURATION/);
});

test("provider/key MUST be explicitly pinned, never inherited via prototype", () => {
  assert.throws(() => validateHybridBankPinnedKey({
    ...args, trustedRegistry: Object.create({
      [providerId]: { [keyId]: entry },
    }),
  }), /NOT_PINNED/);
  assert.throws(() => validateHybridBankPinnedKey({
    ...args, trustedRegistry: { [providerId]: Object.create({ [keyId]: entry }) },
  }), /NOT_PINNED/);
  assert.throws(() => validateHybridBankPinnedKey({
    ...args, keyId: "constructor",
  }), /NOT_PINNED/);
});

test("rotated key IDs are isolated; disabling old key cannot affect separately pinned new key", () => {
  const newKeys = generateKeyPairSync("ed25519");
  const newEntry = {
    ...entry,
    publicKeyPem: newKeys.publicKey.export({ type: "spki", format: "pem" }),
    fingerprintSha256: createHash("sha256")
      .update(newKeys.publicKey.export({ type: "spki", format: "der" }))
      .digest("hex"),
    validFrom: "2026-10-20T00:00:00.000Z",
    validUntil: "2026-12-15T23:59:59.000Z",
  };
  const rotated = { [providerId]: {
    [keyId]: { ...entry, enabled: false },
    new_key_nov: newEntry,
  } };
  assert.throws(() => validateHybridBankPinnedKey({
    ...args, trustedRegistry: rotated,
  }), /DISABLED/);
  const live = validateHybridBankPinnedKey({
    ...args, trustedRegistry: rotated, keyId: "new_key_nov",
  });
  assert.equal(live.asymmetricKeyType, "ed25519");
});

test("key policy is a private read-only helper and never claims banking identity", () => {
  const source = fs.readFileSync("functions/hybrid-billing-bank-key-policy.js", "utf8");
  const prod = fs.readFileSync("functions/bootstrap.js", "utf8")
    + fs.readFileSync("functions/index.js", "utf8");
  assert.doesNotMatch(prod, /hybrid-billing-bank-key-policy/);
  assert.doesNotMatch(source, /fetch\(|onCall\(|onSchedule\(|runTransaction\(|tx\.create\(|tx\.update\(/);
  assert.match(source, /NOT authenticated bank provenance/);
});
