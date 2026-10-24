"use strict";

// Phase 10 — DEMO-ONLY, private immutable audit of proposed bank key metadata.
// This does NOT onboard bank keys, verify bank ownership, or modify the
// trustedRegistry used by hybrid-billing-bank-evidence-contract.js.
// Public/private key material is intentionally NOT persisted.
const { createHash } = require("node:crypto");
const BANK_KEY_ENROLLMENT_PRODUCTION_READY = false;
const PROJECT = "demo-penguin-hybrid";
const ID = /^[A-Za-z0-9_-]{16,80}$/;
const USER = /^[A-Za-z0-9_-]{3,160}$/;
const PROVIDER = /^[a-z][a-z0-9_-]{2,47}$/;
const KEY = /^[A-Za-z0-9_-]{3,80}$/;
const HASH = /^[a-f0-9]{64}$/;
const own = (v,k) => Object.hasOwn(v,k);
const exact = (obj, names) => Boolean(obj && typeof obj === "object"
  && !Array.isArray(obj) && Object.keys(obj).length === names.length
  && names.every(name => own(obj,name)));
const utc = s => typeof s === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)
  && Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s;
const fail = code => { throw Error("HYBRID_BANK_ENROLLMENT_" + code); };
function assertDemo(db) {
  if (BANK_KEY_ENROLLMENT_PRODUCTION_READY
    || db?.app?.options?.projectId !== PROJECT
    || !/^(?:localhost|127\.0\.0\.1):[0-9]+$/.test(
      process.env.FIRESTORE_EMULATOR_HOST || "")
    || typeof db?.collection !== "function"
    || typeof db?.runTransaction !== "function") fail("DEMO_EMULATOR_ONLY");
}
function admin(snapshot) {
  return snapshot?.exists && snapshot.data()?.role === "super_admin"
    && snapshot.data()?.active === true;
}
function validateMetadata(x) {
  const fields = ["requestId","providerId","keyId","fingerprintSha256",
    "validFrom","validUntil","actorUid","requestedAt"];
  if (!exact(x, fields) || !ID.test(String(x.requestId||""))
    || !PROVIDER.test(String(x.providerId||""))
    || !KEY.test(String(x.keyId||""))
    || !HASH.test(String(x.fingerprintSha256||""))
    || !USER.test(String(x.actorUid||""))
    || !utc(x.validFrom) || !utc(x.validUntil) || !utc(x.requestedAt)
    || Date.parse(x.validFrom) >= Date.parse(x.validUntil)
    || Date.parse(x.requestedAt) > Date.parse(x.validFrom)) {
    fail("UNSAFE_METADATA");
  }
}
function claimHash(domain, value) {
  return createHash("sha256").update("hybrid-bank-key-enrollment-v1:" +
    domain + ":" + value).digest("hex");
}
function stamp(stamp) {
  if (!stamp) fail("SERVER_TIMESTAMP_REQUIRED");
  return stamp;
}
/**
 * Record a *request to review* a synthetic public-key fingerprint.
 * 1 key slot / fingerprint cannot be staged twice, including across
 * provider IDs. No PEM is accepted, nor is any bank signer activated.
 */
async function stageDemoHybridBankKeyEnrollment({
  db, requestId, providerId, keyId, fingerprintSha256,
  validFrom, validUntil, actorUid, requestedAt,
  serverTimestamp,
} = {}) {
  assertDemo(db);
  const values = {requestId,providerId,keyId,fingerprintSha256,
    validFrom,validUntil,actorUid,requestedAt};
  validateMetadata(values);
  stamp(serverTimestamp);
  const requestRef=db.collection("hybridBankKeyEnrollmentRequests").doc(requestId);
  const fingerprintRef=db.collection("hybridBankKeyFingerprintClaims")
    .doc(fingerprintSha256);
  const slotHash=claimHash("key-slot",providerId+"/"+keyId);
  const slotRef=db.collection("hybridBankKeySlotClaims").doc(slotHash);
  const actorRef=db.collection("users").doc(actorUid);
  return db.runTransaction(async tx=>{
    // Firestore reads MUST precede writes; role is checked inside TX.
    const [actor, existing, fingerprintClaim, slotClaim] = await Promise.all([
      tx.get(actorRef),tx.get(requestRef),tx.get(fingerprintRef),tx.get(slotRef),
    ]);
    if (!admin(actor)) fail("ACTIVE_SUPER_ADMIN_REQUIRED");
    if (existing.exists) fail("REQUEST_ALREADY_EXISTS");
    if (fingerprintClaim.exists) fail("FINGERPRINT_ALREADY_CLAIMED");
    if (slotClaim.exists) fail("KEY_SLOT_ALREADY_CLAIMED");
    tx.create(fingerprintRef,{
      requestId, providerId, keyId, fingerprintSha256,
      state:"pending_internal_review", createdAt:serverTimestamp,
    });
    tx.create(slotRef,{
      requestId, providerId, keyId, slotHash,
      state:"pending_internal_review", createdAt:serverTimestamp,
    });
    tx.create(requestRef,{
      id:requestId,providerId,keyId,fingerprintSha256,
      validFrom,validUntil,requestedAt,proposedBy:actorUid,
      state:"pending_internal_review",bankOriginAuthenticated:false,
      trustedRegistryPromoted:false,keyActivated:false,
      createdAt:serverTimestamp,
    });
    return Object.freeze({requestId,status:"pending_internal_review",
      keyActivated:false,bankOriginAuthenticated:false,
      trustedRegistryPromoted:false,writesPerformed:true});
  });
}

/**
 * Immutable acknowledgement that a distinct, currently active Super Admin
 * saw the request, NOT proof of an independent bank-source verification.
 */
async function reviewDemoHybridBankKeyEnrollment({
  db,requestId,reviewerUid,decision,reviewedAt,serverTimestamp,
}={}) {
  assertDemo(db);
  if (!ID.test(String(requestId||""))
    || !USER.test(String(reviewerUid||""))
    || !["acknowledge_internal_review","reject"].includes(decision)
    || !utc(reviewedAt)) fail("REVIEW_INPUT_INVALID");
  stamp(serverTimestamp);
  const requestRef=db.collection("hybridBankKeyEnrollmentRequests").doc(requestId);
  const reviewRef=db.collection("hybridBankKeyEnrollmentReviews").doc(requestId);
  const reviewerRef=db.collection("users").doc(reviewerUid);
  return db.runTransaction(async tx=>{
    const [request,existing,reviewer]=await Promise.all([
      tx.get(requestRef),tx.get(reviewRef),tx.get(reviewerRef),
    ]);
    if (!request.exists) fail("REQUEST_MISSING");
    if (existing.exists) fail("ALREADY_REVIEWED");
    if (!admin(reviewer)) fail("ACTIVE_SUPER_ADMIN_REQUIRED");
    const doc=request.data();
    if (doc?.id!==requestId || doc.state!=="pending_internal_review"
      || doc.bankOriginAuthenticated!==false
      || doc.trustedRegistryPromoted!==false || doc.keyActivated!==false
      || !USER.test(String(doc.proposedBy||""))
      || reviewerUid===doc.proposedBy
      || !utc(doc.requestedAt)
      || Date.parse(reviewedAt)<Date.parse(doc.requestedAt)) {
      fail("REVIEW_INTEGRITY_INVALID");
    }
    // Revalidate the proposer's active role while handling review.
    const initiator=await tx.get(db.collection("users").doc(doc.proposedBy));
    if (!admin(initiator)) fail("INITIATOR_REVOKED");
    const status=decision==="reject"?"rejected":"internally_acknowledged_untrusted";
    tx.create(reviewRef,{
      id:requestId,providerId:doc.providerId,keyId:doc.keyId,
      fingerprintSha256:doc.fingerprintSha256,proposedBy:doc.proposedBy,
      reviewedBy:reviewerUid,decision,reviewedAt,status,
      bankOriginAuthenticated:false,
      trustedRegistryPromoted:false,keyActivated:false,
      createdAt:serverTimestamp,
    });
    return Object.freeze({requestId,status,keyActivated:false,
      bankOriginAuthenticated:false,trustedRegistryPromoted:false,
      writesPerformed:true});
  });
}
module.exports={BANK_KEY_ENROLLMENT_PRODUCTION_READY,
  stageDemoHybridBankKeyEnrollment,reviewDemoHybridBankKeyEnrollment};
