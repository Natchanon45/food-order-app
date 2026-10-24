"use strict";

// PRIVATE Phase 10 format preflight. No bank API, payout or Firestore writes.
// An Ed25519 signature using a test key DOES NOT establish real bank provenance.
const { createHash, createPublicKey, verify } = require("node:crypto");
const VERSION = "hybrid_bank_posting_ed25519_v1";
const DOMAIN = "PENGUIN-HYBRID-BANK-EVIDENCE-TEST-CONTRACT-V1\n";
const SHA = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9_:-]{3,160}$/;
const PROVIDER = /^[a-z][a-z0-9_-]{2,47}$/;
const KEY = /^[A-Za-z0-9_-]{3,80}$/;
const FIELDS = Object.freeze(["tenantId", "invoiceId", "adjustmentId",
  "instructionHash", "bankReferenceHash", "destinationFingerprint",
  "amountCents", "currency", "direction", "postingStatus", "submittedAt", "postedAt"]);
const SCOPE = Object.freeze(FIELDS.slice(0, 7));
const exact = (x, fields) => !!(x && typeof x === "object" && !Array.isArray(x)
  && Object.keys(x).length === fields.length
  && fields.every(k => Object.hasOwn(x, k)));
const utc = v => typeof v === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const fail = code => { throw Error("HYBRID_BANK_EVIDENCE_" + code); };
function canonicalHybridBankEvidenceBytes({ version, providerId, keyId, payload } = {}) {
  if (version !== VERSION || !PROVIDER.test(String(providerId || ""))
    || !KEY.test(String(keyId || "")) || !exact(payload, FIELDS)
    || ![payload.tenantId, payload.invoiceId, payload.adjustmentId]
      .every(v => ID.test(String(v || "")))
    || ![payload.instructionHash, payload.bankReferenceHash,
      payload.destinationFingerprint].every(v => SHA.test(String(v || "")))
    || !Number.isSafeInteger(payload.amountCents) || payload.amountCents <= 0
    || payload.amountCents > 100000000000
    || payload.currency !== "THB" || payload.direction !== "debit"
    || payload.postingStatus !== "posted"
    || !utc(payload.submittedAt) || !utc(payload.postedAt)
    || Date.parse(payload.postedAt) < Date.parse(payload.submittedAt)) {
    fail("INVALID_CANONICAL_PAYLOAD");
  }
  const ordered = Object.fromEntries(FIELDS.map(k => [k, payload[k]]));
  return Buffer.from(DOMAIN + JSON.stringify({
    version: VERSION, providerId, keyId, payload: ordered,
  }), "utf8");
}
// TRUST BOUNDARY: server-controlled trustedRegistry must eventually be loaded
// independently from real provider onboarding, NEVER from user/client JSON.
// This module deliberately cannot set real-bank-verified or settled=true.
function verifyHybridSignedBankEvidencePreflight({
  envelope, trustedRegistry, expected, expectedProviderId,
  asOf = new Date().toISOString(),
} = {}) {
  if (!exact(envelope, ["version", "providerId", "keyId", "payload", "signatureBase64"])
    || !PROVIDER.test(String(expectedProviderId || ""))
    || envelope.providerId !== expectedProviderId) fail("ENVELOPE_OR_PROVIDER_INVALID");
  if (!exact(expected, SCOPE)
    || ![expected.tenantId, expected.invoiceId, expected.adjustmentId]
      .every(v => ID.test(String(v || "")))
    || ![expected.instructionHash, expected.bankReferenceHash,
      expected.destinationFingerprint].every(v => SHA.test(String(v || "")))
    || !Number.isSafeInteger(expected.amountCents) || expected.amountCents <= 0
    || !utc(asOf)) fail("TRUSTED_SCOPE_REQUIRED");
  const bytes = canonicalHybridBankEvidenceBytes(envelope);
  for (const field of SCOPE) {
    if (envelope.payload[field] !== expected[field])
      fail("SCOPE_AMOUNT_OR_REFERENCE_MISMATCH");
  }
  if (Date.parse(envelope.payload.postedAt) > Date.parse(asOf))
    fail("POSTED_AFTER_OBSERVATION");
  const keyConfig = trustedRegistry?.[expectedProviderId]?.[envelope.keyId];
  if (!keyConfig || keyConfig.enabled !== true
    || typeof keyConfig.publicKeyPem !== "string"
    || !keyConfig.publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----"))
    fail("TRUSTED_SERVER_KEY_REQUIRED");
  let key;
  try {
    key = createPublicKey(keyConfig.publicKeyPem);
    if (key.asymmetricKeyType !== "ed25519") fail("ED25519_PUBLIC_KEY_REQUIRED");
  } catch { fail("ED25519_PUBLIC_KEY_REQUIRED"); }
  const sig = envelope.signatureBase64;
  if (typeof sig !== "string" || !/^[A-Za-z0-9+/]{86}==$/.test(sig))
    fail("SIGNATURE_ENCODING_INVALID");
  const signatureBytes = Buffer.from(sig, "base64");
  if (signatureBytes.length !== 64 || signatureBytes.toString("base64") !== sig
    || !verify(null, bytes, key, signatureBytes))
    fail("SIGNATURE_VERIFICATION_FAILED");
  return Object.freeze({
    format: VERSION,
    signatureCryptographicallyValid: true,
    evidenceContentSha256: createHash("sha256").update(bytes).digest("hex"),
    payloadScopeMatched: true,
    bankProviderIdentityIndependentlyAuthenticated: false,
    realBankStatementSourceIntegrated: false,
    historicalPayoutsVerified: false,
    settlementConfirmed: false,
    settlementAllowed: false,
    releaseReady: false,
    writesPerformed: false,
    action: "require_independent_bank_provider_onboarding_and_finance_review",
  });
}
module.exports = { canonicalHybridBankEvidenceBytes,
  verifyHybridSignedBankEvidencePreflight };
