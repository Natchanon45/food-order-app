"use strict";

// PRIVATE Final Phase 10. DEMO-ONLY append-only cross-BATCH reservation.
// Synthetic signed data is NEVER authenticated bank provenance or settlement.
const { createHash } = require("node:crypto");
const { preflightHybridSignedBankEvidenceBatch } =
  require("./hybrid-billing-bank-batch-preflight");

const BANK_BATCH_RESERVATION_PRODUCTION_READY = false;
const MAX_ITEMS = 25; // 3 immutable claim writes per item, one batch event.
const PROJECT = "demo-penguin-hybrid";
const ID = /^[A-Za-z0-9_-]{16,80}$/;
const USER = /^[A-Za-z0-9_-]{3,160}$/;
const required = ["db", "batchId", "actorUid", "postings", "trustedRegistry",
  "expectedProviderId", "asOf", "serverTimestamp"];
const own = (v,k) => Object.hasOwn(v,k);
const exact = (v,fields) => Boolean(v && typeof v==="object"
  && !Array.isArray(v) && Object.keys(v).length===fields.length
  && fields.every(k=>own(v,k)));
const fail = code => { throw Error("HYBRID_BANK_BATCH_RESERVATION_"+code); };
const scopeHash = (tenantId,adjustmentId) => createHash("sha256")
  .update("PENGUIN-HYBRID-BANK-ADJUSTMENT-CLAIM-V1\n"+
    JSON.stringify([tenantId,adjustmentId]),"utf8").digest("hex");

function requireDemo(db) {
  if (BANK_BATCH_RESERVATION_PRODUCTION_READY
    || db?.app?.options?.projectId!==PROJECT
    || !/^(?:127\.0\.0\.1|localhost):[0-9]+$/.test(
      process.env.FIRESTORE_EMULATOR_HOST||"")
    || typeof db?.collection!=="function"
    || typeof db?.runTransaction!=="function") fail("LOCAL_DEMO_ONLY");
}

/**
 * Caller MUST be trusted server code supplying the expected financial scope
 * and a server-controlled (still only synthetic) public key registry. No
 * Browser, callable or Production import is wired to this function.
 *
 * All transaction reads precede ALL creates. Existing older demo refund
 * reference/instruction claims are also checked; the existing refund writer
 * does NOT reciprocally inspect this new ledger, so this is NOT a universal
 * cross-channel anti-replay or historical bank statement check.
 */
async function reserveDemoHybridSignedBankBatch(input = {}) {
  if (!exact(input,required)) fail("INVALID_INPUT_FIELDS");
  const { db,batchId,actorUid,postings,trustedRegistry,
    expectedProviderId,asOf,serverTimestamp } = input;
  requireDemo(db);
  if (!ID.test(String(batchId||"")) || !USER.test(String(actorUid||""))
    || !serverTimestamp || !Array.isArray(postings)
    || postings.length<1 || postings.length>MAX_ITEMS) {
    fail("INVALID_METADATA_OR_BATCH_SIZE");
  }
  // Cryptographic, identity/amount/scope and intra-batch replay preflight
  // before any database access. This remains SYNTHETIC evidence.
  const evidence=preflightHybridSignedBankEvidenceBatch({
    postings,trustedRegistry,expectedProviderId,asOf,
  });
  if (evidence.postingsChecked!==postings.length
    || evidence.bankProviderIdentityIndependentlyAuthenticated!==false
    || evidence.realBankStatementSourceIntegrated!==false
    || evidence.settlementAllowed!==false || evidence.writesPerformed!==false) {
    fail("UNSAFE_PREFLIGHT");
  }
  const batchRef=db.collection("hybridBankBatchReservations").doc(batchId);
  const actorRef=db.collection("users").doc(actorUid);
  const claims=postings.map(({expected})=>({
    reference:db.collection("hybridBankBatchReferenceClaims")
      .doc(expected.bankReferenceHash),
    instruction:db.collection("hybridBankBatchInstructionClaims")
      .doc(expected.instructionHash),
    adjustment:db.collection("hybridBankBatchAdjustmentClaims")
      .doc(scopeHash(expected.tenantId,expected.adjustmentId)),
    priorReference:db.collection("hybridRefundReferenceClaims")
      .doc(expected.bankReferenceHash),
    priorInstruction:db.collection("hybridRefundInstructionClaims")
      .doc(expected.instructionHash),
  }));
  return db.runTransaction(async tx=>{
    const refs=[actorRef,batchRef,...claims.flatMap(item=>Object.values(item))];
    const existing=await Promise.all(refs.map(ref=>tx.get(ref)));
    const actor=existing[0].exists?existing[0].data():null;
    if (!actor || actor.role!=="super_admin" || actor.active!==true) {
      fail("ACTIVE_SUPER_ADMIN_REQUIRED");
    }
    // Do not disclose which hash was claimed by which tenant/provider.
    if (existing.slice(1).some(row=>row.exists)) {
      fail("BATCH_OR_REFERENCE_ALREADY_RESERVED");
    }
    // Immutable, globally unique within this DEMO claim scheme. No values
    // that authorize settlement, actual bank payout or key activation.
    for (const item of claims) {
      for (const [kind,ref] of [
        ["reference",item.reference],["instruction",item.instruction],
        ["adjustment",item.adjustment],
      ]) tx.create(ref,{
        batchId,kind,createdAt:serverTimestamp,
        state:"synthetic_untrusted_reservation",
        bankOriginAuthenticated:false,settlementConfirmed:false,
      });
    }
    tx.create(batchRef,{
      batchId,actorUid,createdAt:serverTimestamp,
      itemCount:postings.length,
      batchContentSha256:evidence.batchContentSha256,
      state:"synthetic_untrusted_reservation",
      bankOriginAuthenticated:false,
      realBankStatementSourceIntegrated:false,
      settlementConfirmed:false,
    });
    return Object.freeze({
      status:"synthetic_untrusted_reservation",
      postingsReserved:postings.length,
      crossBatchClaimsCreated:true,
      globalHistoricalReplayChecked:false,
      bankProviderIdentityIndependentlyAuthenticated:false,
      realBankStatementSourceIntegrated:false,
      historicalPayoutsVerified:false,
      settlementConfirmed:false,
      settlementAllowed:false,
      productionReleaseAllowed:false,
      releaseReady:false,
      writesPerformed:true, // ONLY local demo audit claims, NEVER payout.
    });
  });
}

module.exports={BANK_BATCH_RESERVATION_PRODUCTION_READY,
  reserveDemoHybridSignedBankBatch};
