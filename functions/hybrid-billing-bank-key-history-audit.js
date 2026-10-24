"use strict";

// PRIVATE, read-only and DEMO-ONLY integrity inventory for internal key
// enrollment. Checking Firestore docs never authenticates an external bank.
const { createHash } = require("node:crypto");
const MAX_RECORDS_PER_COLLECTION = 500;
const SOURCES = Object.freeze([
  "hybridBankKeyEnrollmentRequests",
  "hybridBankKeyEnrollmentReviews",
  "hybridBankKeyFingerprintClaims",
  "hybridBankKeySlotClaims",
]);
const ID = /^[A-Za-z0-9_-]{16,80}$/;
const USER = /^[A-Za-z0-9_-]{3,160}$/;
const PROVIDER = /^[a-z][a-z0-9_-]{2,47}$/;
const KEY = /^[A-Za-z0-9_-]{3,80}$/;
const HASH = /^[a-f0-9]{64}$/;
const utc = s => typeof s === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)
  && Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s;
const exact = (v, fields) => Boolean(v && typeof v === "object"
  && !Array.isArray(v) && Object.keys(v).length === fields.length
  && fields.every(key => Object.hasOwn(v, key)));
const REQUEST_FIELDS = Object.freeze(["id","providerId","keyId",
  "fingerprintSha256","validFrom","validUntil","requestedAt","proposedBy",
  "state","bankOriginAuthenticated","trustedRegistryPromoted","keyActivated",
  "createdAt"]);
const REVIEW_FIELDS = Object.freeze(["id","providerId","keyId",
  "fingerprintSha256","proposedBy","reviewedBy","decision","reviewedAt",
  "status","bankOriginAuthenticated","trustedRegistryPromoted",
  "keyActivated","createdAt"]);
const FINGERPRINT_FIELDS = Object.freeze(["requestId","providerId","keyId",
  "fingerprintSha256","state","createdAt"]);
const SLOT_FIELDS = Object.freeze(["requestId","providerId","keyId",
  "slotHash","state","createdAt"]);
const fail = code => { throw Error("HYBRID_BANK_KEY_AUDIT_" + code); };
const slotHashFor = (providerId,keyId) => createHash("sha256").update(
  "hybrid-bank-key-enrollment-v1:key-slot:" + providerId + "/" + keyId,
).digest("hex");

function requireIsolatedDemo(db) {
  if (db?.app?.options?.projectId !== "demo-penguin-hybrid"
    || !/^(?:127\.0\.0\.1|localhost):[0-9]+$/.test(
      process.env.FIRESTORE_EMULATOR_HOST || "")
    || typeof db?.collection !== "function") fail("DEMO_ONLY");
}
async function readBounded(db,collection,max) {
  const snapshot = await db.collection(collection).limit(max+1).get();
  if (!snapshot || !Array.isArray(snapshot.docs)
    || snapshot.docs.length > max) fail("SCAN_OVERFLOW_"+collection);
  const values = new Map();
  for(const doc of snapshot.docs) {
    if (!doc || typeof doc.id !== "string" || !doc.id
      || doc.ref?.path !== collection+"/"+doc.id
      || typeof doc.data !== "function"
      || values.has(doc.id)) fail("BAD_DOCUMENT_"+collection);
    values.set(doc.id,doc.data());
  }
  return values;
}

function reviewAuditCollections(rows) {
  const issues = new Set();
  const add = name => issues.add(name);
  const requests=rows.hybridBankKeyEnrollmentRequests;
  const reviews=rows.hybridBankKeyEnrollmentReviews;
  const fingerprintClaims=rows.hybridBankKeyFingerprintClaims;
  const slotClaims=rows.hybridBankKeySlotClaims;
  const recognizedFingerprints=new Set();
  const recognizedSlots=new Set();
  let pendingInternalReviews=0;
  for(const [requestId,r] of requests) {
    if (!ID.test(requestId)
      || !exact(r,REQUEST_FIELDS) || r.id!==requestId
      || !PROVIDER.test(String(r.providerId||""))
      || !KEY.test(String(r.keyId||""))
      || !HASH.test(String(r.fingerprintSha256||""))
      || !USER.test(String(r.proposedBy||""))
      || !utc(r.requestedAt) || !utc(r.validFrom) || !utc(r.validUntil)
      || Date.parse(r.requestedAt)>Date.parse(r.validFrom)
      || Date.parse(r.validFrom)>=Date.parse(r.validUntil)
      || r.state!=="pending_internal_review"
      || r.bankOriginAuthenticated!==false
      || r.trustedRegistryPromoted!==false || r.keyActivated!==false
      || !r.createdAt) {
      add("REQUEST_SHAPE_OR_TRUST_FLAG_INVALID");
      continue;
    }
    const hash=slotHashFor(r.providerId,r.keyId);
    recognizedFingerprints.add(r.fingerprintSha256);
    recognizedSlots.add(hash);
    const fp=fingerprintClaims.get(r.fingerprintSha256);
    const slot=slotClaims.get(hash);
    if (!exact(fp,FINGERPRINT_FIELDS)
      || fp.requestId!==requestId || fp.providerId!==r.providerId
      || fp.keyId!==r.keyId || fp.fingerprintSha256!==r.fingerprintSha256
      || fp.state!=="pending_internal_review" || !fp.createdAt) {
      add("FINGERPRINT_RESERVATION_MISMATCH");
    }
    if (!exact(slot,SLOT_FIELDS) || slot.requestId!==requestId
      || slot.providerId!==r.providerId || slot.keyId!==r.keyId
      || slot.slotHash!==hash || slot.state!=="pending_internal_review"
      || !slot.createdAt) {
      add("KEY_SLOT_RESERVATION_MISMATCH");
    }
    const event=reviews.get(requestId);
    if (event===undefined) {
      pendingInternalReviews++;
    } else if (!exact(event,REVIEW_FIELDS) || event.id!==requestId
      || event.providerId!==r.providerId || event.keyId!==r.keyId
      || event.fingerprintSha256!==r.fingerprintSha256
      || event.proposedBy!==r.proposedBy
      || !USER.test(String(event.reviewedBy||""))
      || event.reviewedBy===r.proposedBy || !utc(event.reviewedAt)
      || Date.parse(event.reviewedAt)<Date.parse(r.requestedAt)
      || Date.parse(event.reviewedAt)>Date.parse(r.validUntil)
      || !["acknowledge_internal_review","reject"].includes(event.decision)
      || event.status!==(event.decision==="reject"
        ? "rejected":"internally_acknowledged_untrusted")
      || event.bankOriginAuthenticated!==false
      || event.trustedRegistryPromoted!==false
      || event.keyActivated!==false || !event.createdAt) {
      add("REVIEW_EVENT_MISMATCH");
    }
  }
  for(const [id,claim] of fingerprintClaims) {
    const request=requests.get(claim?.requestId);
    if (!HASH.test(id) || !request || request.fingerprintSha256!==id
      || !recognizedFingerprints.has(id)
      || !exact(claim,FINGERPRINT_FIELDS)
      || claim.fingerprintSha256!==id
      || claim.providerId!==request.providerId
      || claim.keyId!==request.keyId
      || claim.state!=="pending_internal_review") {
      add("ORPHAN_OR_SPOOFED_FINGERPRINT_CLAIM");
    }
  }
  for(const [id,claim] of slotClaims) {
    const request=requests.get(claim?.requestId);
    if (!HASH.test(id) || !request
      || !recognizedSlots.has(id)
      || !exact(claim,SLOT_FIELDS)
      || claim.slotHash!==id
      || claim.providerId!==request.providerId
      || claim.keyId!==request.keyId
      || slotHashFor(request.providerId,request.keyId)!==id
      || claim.state!=="pending_internal_review") {
      add("ORPHAN_OR_SPOOFED_KEY_SLOT_CLAIM");
    }
  }
  for(const [id,event] of reviews) {
    if (!requests.has(id) || !event || event.id!==id) {
      add("ORPHAN_REVIEW_EVENT");
    }
  }
  return { integrityIssueCodes:[...issues].sort(), pendingInternalReviews };
}

/**
 * Reads exactly four private global Emulator collections. These are
 * separate non-atomic scans and DO NOT prove completeness of bank
 * statements, historical key enrollments or external signer ownership.
 * Never returns provider ID, key ID, fingerprints, user IDs or records.
 */
async function auditDemoHybridBankKeyHistory({db,maxPerSource=100}={}) {
  requireIsolatedDemo(db);
  if (!Number.isSafeInteger(maxPerSource)
    || maxPerSource<1 || maxPerSource>MAX_RECORDS_PER_COLLECTION) {
    fail("INVALID_SCAN_LIMIT");
  }
  const rows={};
  for(const collection of SOURCES) {
    rows[collection]=await readBounded(db,collection,maxPerSource);
  }
  const { integrityIssueCodes,pendingInternalReviews } =
    reviewAuditCollections(rows);
  return Object.freeze({
    kind:"demo_bank_key_enrollment_integrity_inventory",
    scannedCollections:Object.freeze([...SOURCES]),
    counts:Object.freeze(Object.fromEntries(
      SOURCES.map(name=>[name,rows[name].size]))),
    pendingInternalReviews,
    integrityIssueCodes:Object.freeze(integrityIssueCodes),
    integrityIssueCount:integrityIssueCodes.length,
    mode:"local_emulator_diagnostic_only",
    nonAtomicSnapshot:true,
    bankOriginAuthenticated:false,
    trustedRegistryPromoted:false,
    anyKeyActivated:false,
    historicalKeyCoverageVerified:false,
    settlementAllowed:false,
    releaseReady:false,
    writesPerformed:false,
    blockers:Object.freeze([
      "BANK_SIGNER_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED",
      "HISTORICAL_BANK_KEY_LIFECYCLE_NOT_RECONCILED",
      "NON_ATOMIC_EMULATOR_ONLY_SCAN",
      ...(pendingInternalReviews?["PENDING_INTERNAL_KEY_REVIEWS"]:[]),
      ...integrityIssueCodes,
    ]),
  });
}
module.exports={auditDemoHybridBankKeyHistory};
