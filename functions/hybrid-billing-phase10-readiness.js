"use strict";

// PRIVATE demo-only Phase 10 FINANCE + KEY-HISTORY diagnostic merger.
// Not production bank provenance or a release authorization. No writers.
const { auditDemoHybridRefundHistory } = require("./hybrid-billing-refund-history-audit");
const { auditDemoHybridBankKeyHistory } = require("./hybrid-billing-bank-key-history-audit");
const { buildDemoHybridFinanceWorklist } = require("./hybrid-billing-finance-worklist");

const KEY_SOURCES = Object.freeze([
  "hybridBankKeyEnrollmentRequests", "hybridBankKeyEnrollmentReviews",
  "hybridBankKeyFingerprintClaims", "hybridBankKeySlotClaims",
]);
const KEY_BLOCKERS = Object.freeze([
  ["BANK_SIGNER_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED",
    "ยังไม่ได้รับรองเจ้าของกุญแจจากธนาคาร/ผู้ให้บริการโดยอิสระ"],
  ["HISTORICAL_BANK_KEY_LIFECYCLE_NOT_RECONCILED",
    "ยังไม่ได้กระทบยอดประวัติการหมุนเวียนและเพิกถอนกุญแจย้อนหลัง"],
  ["NON_ATOMIC_EMULATOR_ONLY_SCAN",
    "ข้อมูลที่ตรวจเป็นการอ่านหลาย Collections แบบไม่ใช่ Snapshot เดียวกัน"],
]);
const KEY_ISSUES = Object.freeze({
  REQUEST_SHAPE_OR_TRUST_FLAG_INVALID:
    "ตรวจรูปแบบคำขอและธงรับรองธนาคาร/เปิดใช้กุญแจที่ผิดปกติ",
  FINGERPRINT_RESERVATION_MISMATCH:
    "ตรวจ Global Fingerprint Claim ที่หายหรือไม่ตรงกับคำขอ",
  KEY_SLOT_RESERVATION_MISMATCH:
    "ตรวจ Global Provider/Key Slot Claim ที่หายหรือไม่ตรง",
  ORPHAN_OR_SPOOFED_FINGERPRINT_CLAIM:
    "ตรวจ Fingerprint Claim ที่ไม่มีคำขอต้นทางหรือถูกปลอมอ้าง",
  ORPHAN_OR_SPOOFED_KEY_SLOT_CLAIM:
    "ตรวจ Key Slot Claim ที่ไม่มีคำขอต้นทางหรือถูกปลอมอ้าง",
  ORPHAN_REVIEW_EVENT:
    "ตรวจ Review Event ที่ไม่มีคำขอลงทะเบียนกุญแจต้นฉบับ",
  REVIEW_EVENT_MISMATCH:
    "ตรวจผู้ตรวจคนที่สอง เวลา ผลทบทวน และธงเปิดใช้ที่ไม่ตรงกัน",
});
const PENDING = "PENDING_INTERNAL_KEY_REVIEWS";
const fail = code => { throw new Error("HYBRID_PHASE10_READINESS_" + code); };
const knownKeyCode = code => Object.hasOwn(KEY_ISSUES,code);
const task = (area,code,actionTH,priority) => Object.freeze({
  area,code,actionTH,priority,
  bankAuthenticated:false,
  resolved:false,
  settlementAuthorized:false,
});
const expectedKeyBlockers = keyAudit => [
  ...KEY_BLOCKERS.map(([code])=>code),
  ...(keyAudit.pendingInternalReviews ? [PENDING] : []),
  ...keyAudit.integrityIssueCodes,
];

function validateKeyAudit(keyAudit) {
  if (!keyAudit || typeof keyAudit !== "object"
    || keyAudit.kind !== "demo_bank_key_enrollment_integrity_inventory"
    || keyAudit.mode !== "local_emulator_diagnostic_only"
    || keyAudit.nonAtomicSnapshot !== true
    || keyAudit.bankOriginAuthenticated !== false
    || keyAudit.trustedRegistryPromoted !== false
    || keyAudit.anyKeyActivated !== false
    || keyAudit.historicalKeyCoverageVerified !== false
    || keyAudit.settlementAllowed !== false
    || keyAudit.releaseReady !== false
    || keyAudit.writesPerformed !== false
    || !Array.isArray(keyAudit.scannedCollections)
    || keyAudit.scannedCollections.length !== KEY_SOURCES.length
    || !KEY_SOURCES.every((name,i)=>keyAudit.scannedCollections[i]===name)
    || !keyAudit.counts || typeof keyAudit.counts !== "object"
    || !KEY_SOURCES.every(name =>
      Number.isSafeInteger(keyAudit.counts[name])
      && keyAudit.counts[name] >= 0 && keyAudit.counts[name] <= 500)
    || !Number.isSafeInteger(keyAudit.pendingInternalReviews)
    || keyAudit.pendingInternalReviews < 0
    || keyAudit.pendingInternalReviews >
      keyAudit.counts.hybridBankKeyEnrollmentRequests
    || !Array.isArray(keyAudit.integrityIssueCodes)
    || !Number.isSafeInteger(keyAudit.integrityIssueCount)
    || keyAudit.integrityIssueCount !== keyAudit.integrityIssueCodes.length
    || keyAudit.integrityIssueCount > 50
    || keyAudit.integrityIssueCodes.some(x=>typeof x !== "string")
    || new Set(keyAudit.integrityIssueCodes).size !== keyAudit.integrityIssueCount
    || !Array.isArray(keyAudit.blockers)) {
    fail("INVALID_BANK_KEY_AUDIT");
  }
  const allowedBlockers=expectedKeyBlockers(keyAudit);
  if (keyAudit.blockers.length !== allowedBlockers.length
    || allowedBlockers.some((code,i)=>keyAudit.blockers[i]!==code)) {
    fail("BANK_KEY_BLOCKERS_INCONSISTENT");
  }
}

/**
 * Builds a REDACTED, blocked triage from two independently fetched reports.
 * The pure input validation does not authenticate where reports came from.
 * A matching local diagnostic is NEVER permission to turn a real payout on.
 */
function buildDemoHybridPhase10Readiness({ financeAudit, keyAudit } = {}) {
  // This finance mapper rejects forged settled/ready/bank-origin flags and
  // strips ALL unknown diagnostic strings instead of echoing raw data.
  const financeWorklist = buildDemoHybridFinanceWorklist(financeAudit);
  validateKeyAudit(keyAudit);
  const keyIssueCodes = keyAudit.integrityIssueCodes;
  const unknownKeyCount = keyIssueCodes.filter(x=>!knownKeyCode(x)).length;

  const tasks = [
    ...financeWorklist.items.map(item => task("hybrid_finance",
      item.code,item.actionTH,item.severity)),
    ...KEY_BLOCKERS.map(([code,thai])=>
      task("bank_signing_key",code,thai,"release_blocker")),
    ...(keyAudit.pendingInternalReviews ? [task("bank_signing_key",PENDING,
      "ยังมีคำขอลงทะเบียนกุญแจที่รอผู้ตรวจคนที่สอง",
      "internal_review_pending")] : []),
    ...keyIssueCodes.filter(knownKeyCode).sort().map(code =>
      task("bank_signing_key",code,KEY_ISSUES[code],"integrity_exception")),
    ...(unknownKeyCount ? [task("bank_signing_key",
      "UNKNOWN_BANK_KEY_AUDIT_ISSUE",
      "พบข้อผิดพลาดที่ไม่รู้จัก ต้องตรวจโค้ดและเอกสารฝั่ง Server",
      "integrity_exception")] : []),
  ];
  const counts = Object.freeze({
    hybridFinance: financeWorklist.counts,
    bankKeyEnrollment: Object.freeze(Object.fromEntries(
      KEY_SOURCES.map(name=>[name,keyAudit.counts[name]]))),
  });
  const totalFinanceRecords=Object.entries(financeWorklist.counts)
    .filter(([name])=>name!=="lalamoveWalletDeliveryRefundCredits")
    .reduce((n,[,count])=>n+count,0);
  const totalKeyRecords=KEY_SOURCES.reduce(
    (sum,name)=>sum+keyAudit.counts[name],0);

  return Object.freeze({
    kind:"hybrid_phase10_unified_finance_release_readiness",
    mode:"local_demo_diagnostic_only",
    status:"blocked_real_bank_and_independent_settlement_approval",
    sourcesScanned:16,
    sourceCounts:counts,
    totalRecordsSeen: totalFinanceRecords+totalKeyRecords,
    pendingInternalKeyReviews:keyAudit.pendingInternalReviews,
    financeIntegrityExceptionCount:financeAudit.integrityIssueCount,
    keyIntegrityExceptionCount:keyAudit.integrityIssueCount,
    unknownKeyIssueCount:unknownKeyCount,
    walletDeliveryRefundCredits:financeWorklist.counts.lalamoveWalletDeliveryRefundCredits,
    walletCreditIsOutgoingBankRefund:false,
    bankSignerOwnerAuthenticated:false,
    bankStatementSourceAuthenticated:false,
    historicalBankSettlementCoverageVerified:false,
    independentFinalSettlementAuthorized:false,
    allSourcesAtomicSnapshot:false,
    bankTransferConfirmed:false,
    eligibleForBankSettlement:false,
    productionReleaseAllowed:false,
    writesPerformed:false,
    tasks:Object.freeze(tasks),
    taskCount:tasks.length,
  });
}

/**
 * One entry point, both existing read-only audits. Their collection reads
 * remain non-atomic; fail closed if either scan fails/overflows.
 */
async function auditDemoHybridPhase10Readiness({db,maxPerSource=100}={}) {
  const financeAudit=await auditDemoHybridRefundHistory({db,maxPerSource});
  const keyAudit=await auditDemoHybridBankKeyHistory({db,maxPerSource});
  return buildDemoHybridPhase10Readiness({financeAudit,keyAudit});
}

module.exports={
  buildDemoHybridPhase10Readiness,
  auditDemoHybridPhase10Readiness,
};
