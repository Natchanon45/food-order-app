"use strict";

// Phase 10 SERVER-ONLY key hygiene. Even a pinned Ed25519 key with two
// internal reviewers is NOT authenticated bank provenance. The registry
// must eventually come from independent bank/provider key onboarding;
// never trust an uploaded or browser-supplied registry.
const { createHash, createPublicKey } = require("node:crypto");
const HEX = /^[a-f0-9]{64}$/;
const USER = /^[A-Za-z0-9_-]{3,160}$/;
const ID = /^[a-z][a-z0-9_-]{2,47}$/;
const KEY = /^[A-Za-z0-9_-]{3,80}$/;
const FIELDS = Object.freeze([
  "enabled", "publicKeyPem", "fingerprintSha256", "validFrom",
  "validUntil", "revokedAt", "registeredBy", "reviewedBy",
]);
const own = (obj, k) => Object.hasOwn(obj, k);
const fail = code => { throw Error("HYBRID_BANK_KEY_" + code); };
const utc = v => typeof v === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;

function validateHybridBankPinnedKey({
  trustedRegistry, providerId, keyId, postingAt, checkedAt,
} = {}) {
  if (!ID.test(String(providerId || "")) || !KEY.test(String(keyId || ""))
    || !utc(postingAt) || !utc(checkedAt)) fail("INVALID_LOOKUP");
  // Explicit OWN properties exclude Object.prototype/constructor fallback.
  if (!trustedRegistry || typeof trustedRegistry !== "object"
    || Array.isArray(trustedRegistry)
    || !own(trustedRegistry, providerId)) fail("NOT_PINNED");
  const keys = trustedRegistry[providerId];
  if (!keys || typeof keys !== "object" || Array.isArray(keys)
    || !own(keys, keyId)) fail("NOT_PINNED");
  const entry = keys[keyId];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)
    || Object.keys(entry).length !== FIELDS.length
    || !FIELDS.every(key => own(entry, key))) fail("INVALID_CONFIGURATION");
  if (entry.enabled !== true) fail("DISABLED");
  if (entry.revokedAt !== null) {
    // Fail closed even for old postings; historical key trust requires
    // independently authenticated historical revocation records.
    if (!utc(entry.revokedAt)) fail("INVALID_CONFIGURATION");
    fail("REVOKED");
  }
  if (typeof entry.publicKeyPem !== "string"
    || entry.publicKeyPem.length > 4096
    || !entry.publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----")
    || !HEX.test(String(entry.fingerprintSha256 || ""))
    || !utc(entry.validFrom) || !utc(entry.validUntil)
    || !USER.test(String(entry.registeredBy || ""))
    || !USER.test(String(entry.reviewedBy || ""))
    || entry.registeredBy === entry.reviewedBy) fail("INVALID_CONFIGURATION");
  const from = Date.parse(entry.validFrom), until = Date.parse(entry.validUntil);
  if (from >= until) fail("INVALID_WINDOW");
  if (Date.parse(postingAt) < from || Date.parse(postingAt) > until
    || Date.parse(checkedAt) < from || Date.parse(checkedAt) > until
    || Date.parse(checkedAt) < Date.parse(postingAt)) {
    fail("OUTSIDE_VALIDITY_WINDOW");
  }
  let publicKey;
  try { publicKey = createPublicKey(entry.publicKeyPem); }
  catch { fail("INVALID_PUBLIC_KEY"); }
  if (publicKey.asymmetricKeyType !== "ed25519") fail("ED25519_REQUIRED");
  const actualFingerprint = createHash("sha256")
    .update(publicKey.export({ type: "spki", format: "der" }))
    .digest("hex");
  if (actualFingerprint !== entry.fingerprintSha256) fail("FINGERPRINT_MISMATCH");
  return publicKey;
}
module.exports = { validateHybridBankPinnedKey };
