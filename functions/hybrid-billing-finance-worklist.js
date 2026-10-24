"use strict";

// Read-only finance triage from an already SANITIZED demo history audit.
// Never a bank statement, refund instruction, settlement approval or payout.
// Deliberately has NO database/network imports or write capabilities.
const REQUIRED = Object.freeze([
  ["EXTERNAL_BANK_STATEMENT_SOURCE_NOT_AUTHENTICATED", "bank_source", "ต้องยืนยันแหล่งข้อมูลรายการเดินบัญชีจากธนาคาร", "Authenticate the bank statement source independently"],
  ["LEGACY_OUTGOING_BANK_REFUNDS_NOT_MIGRATED", "history", "ตรวจรายการคืนเงินย้อนหลังและเอกสารเดิมให้ครบ", "Reconcile pre-migration outgoing refunds and archive records"],
  ["CROSS_CHANNEL_AND_ARCHIVED_BANK_PAYOUTS_NOT_RECONCILED", "cross_channel", "แยกและกระทบยอดการคืนเงินข้ามช่องทาง", "Reconcile manual, bank and provider payout histories"],
  ["NO_ATOMIC_GLOBAL_HISTORICAL_COVERAGE_SNAPSHOT", "completeness", "ยืนยันความครบถ้วนของข้อมูลจากแหล่งเดียวกัน ณ จุดตรวจ", "Establish independent completeness of the historical sources"],
]);
const INTEGRITY = Object.freeze({
  CANDIDATE_IDENTITY_OR_SCOPE_INVALID: ["identity", "ตรวจร้านค้าและเลขเอกสาร Candidate"],
  CANDIDATE_PAID_INVOICE_PROVENANCE_MISSING: ["invoice", "ยืนยัน Invoice ที่ชำระแล้วและลายเซ็นเดิม"],
  CANDIDATE_APPROVED_ADJUSTMENT_MISSING: ["approval", "ค้นหา Refund Request ที่ได้รับอนุมัติภายใน"],
  CANDIDATE_INDEPENDENT_REVIEW_MISSING: ["approval", "ตรวจ Review Event และผู้อนุมัติแยกจากผู้ยื่น"],
  CANDIDATE_AMOUNT_MISMATCH: ["money", "กระทบยอดจำนวนเงินใน Invoice, Adjustment และ Candidate"],
  CANDIDATE_SEPARATION_OF_DUTIES_MISSING: ["access", "ตรวจผู้ยื่น ผู้อนุมัติ และผู้บันทึกต้องไม่ใช่คนเดียวกัน"],
  CANDIDATE_HASH_MISSING_OR_INVALID: ["reference", "ตรวจรูปแบบ Hash ของหลักฐาน (ห้ามเปิดเผยเลขอ้างอิงจริง)"],
  CANDIDATE_UNTRUSTED_SETTLEMENT_FLAG: ["forgery", "ตรวจสถานะที่อ้างว่าคืนเงินสำเร็จโดยไม่มีหลักฐานธนาคาร"],
  BANK_REFERENCE_INDEX_INCOMPLETE: ["reference", "ตรวจ Global Bank Reference Claim ที่ขาดหรือไม่ตรงกัน"],
  OUTGOING_INSTRUCTION_INDEX_INCOMPLETE: ["reference", "ตรวจ Global Instruction Claim ที่ขาดหรือไม่ตรงกัน"],
  BANK_REFERENCE_ORPHAN_OR_CONFLICT: ["reference", "ตรวจ Bank Reference Claim ที่ไม่มี Candidate ถูกต้อง"],
  OUTGOING_INSTRUCTION_ORPHAN_OR_CONFLICT: ["reference", "ตรวจ Instruction Claim ที่ไม่มี Candidate ถูกต้อง"],
  INVOICE_IDENTITY_OR_SCOPE_INVALID: ["identity", "ตรวจ Invoice ID และร้านต้นทาง"],
  ADJUSTMENT_IDENTITY_OR_SCOPE_INVALID: ["identity", "ตรวจ Adjustment ID และร้านต้นทาง"],
  ADJUSTMENT_EVENT_IDENTITY_OR_SCOPE_INVALID: ["identity", "ตรวจ Audit Event ID และร้านต้นทาง"],
  ADJUSTMENT_BALANCE_IDENTITY_OR_SCOPE_INVALID: ["identity", "ตรวจ Reserved Balance และร้านต้นทาง"],
  ADJUSTMENT_INVOICE_OR_AMOUNT_MISMATCH: ["money", "กระทบยอด Adjustment กับยอด Invoice ต้นฉบับ"],
  ADJUSTMENT_REVIEW_EVENT_INCOMPLETE: ["approval", "ตรวจ Review Event ที่ขาดหรือเปลี่ยนแปลง"],
  ADJUSTMENT_INVALID_STATUS_OR_PREMATURE_REVIEW: ["approval", "ตรวจลำดับสถานะคำขอและการอนุมัติ"],
  ADJUSTMENT_RESERVED_BALANCE_MISMATCH: ["money", "ตรวจยอดรวมรายการที่กันไว้และจำนวนคำขอต่อ Invoice"],
  ADJUSTMENT_BALANCE_ORPHAN: ["money", "ตรวจยอดกันเงินที่ไม่พบ Adjustment"],
  ADJUSTMENT_REVIEW_EVENT_ORPHAN: ["approval", "ตรวจรายการอนุมัติที่ไม่มี Adjustment อ้างอิง"],
});
const CATEGORIES = Object.freeze({
  bank_source: "ธนาคารและต้นทางข้อมูล",
  history: "ธุรกรรมย้อนหลัง",
  cross_channel: "ธุรกรรมข้ามช่องทาง",
  completeness: "ความครบถ้วนของข้อมูล",
  identity: "เอกสารและร้านค้า",
  invoice: "ใบแจ้งหนี้",
  approval: "การอนุมัติ",
  money: "ยอดเงินและวงเงินกันไว้",
  access: "การแยกหน้าที่ผู้ตรวจ",
  reference: "รายการอ้างอิงซ้ำ",
  forgery: "ความถูกต้องของสถานะ",
});
const EXPECTED = Object.freeze([
  "hybridRefundReferenceClaims", "hybridRefundInstructionClaims",
  "financeSlipClaims", "hybridBillingRefundCandidates",
  "hybridBillingAdjustments", "hybridBillingPaymentAttempts",
  "revenueSharePayments", "lalamoveWalletTopups",
  "lalamoveWalletTransactions", "hybridBillingInvoices",
  "hybridBillingAdjustmentEvents", "hybridBillingAdjustmentBalances",
]);
const blocker = (code, category, actionTH, actionEN, severity) => Object.freeze({
  code, severity, category: CATEGORIES[category], actionTH, actionEN,
  evidenceVerified: false, resolved: false,
});

function buildDemoHybridFinanceWorklist(report) {
  if (!report || typeof report !== "object"
    || report.mode !== "demo_inventory_diagnostic_only"
    || report.status !== "blocked_manual_finance_reconciliation"
    || report.releaseReady !== false || report.settlementAllowed !== false
    || report.bankSourceAuthenticated !== false
    || report.historicalBankCoverageVerified !== false
    || report.atomicSnapshot !== false || report.writesPerformed !== false
    || !Array.isArray(report.sourcesScanned)
    || report.sourcesScanned.length !== EXPECTED.length
    || !EXPECTED.every((name, index) => report.sourcesScanned[index] === name)
    || !report.counts || typeof report.counts !== "object"
    || !EXPECTED.every(name => Number.isSafeInteger(report.counts[name])
      && report.counts[name] >= 0 && report.counts[name] <= 500)
    || !Number.isSafeInteger(report.counts.lalamoveWalletDeliveryRefundCredits)
    || report.counts.lalamoveWalletDeliveryRefundCredits < 0
    || report.counts.lalamoveWalletDeliveryRefundCredits
      > report.counts.lalamoveWalletTransactions
    || !Array.isArray(report.integrityIssueCodes)
    || !Number.isSafeInteger(report.integrityIssueCount)
    || report.integrityIssueCodes.length !== report.integrityIssueCount
    || report.integrityIssueCodes.length > 100
    || !Array.isArray(report.blockers)) {
    throw new Error("HYBRID_FINANCE_WORKLIST_UNTRUSTED_DIAGNOSTIC");
  }

  // Known issue codes are allowlisted; never echo an untrusted string that
  // might contain raw account details, injected markup or a transaction ID.
  const unique = new Set();
  let unknown = 0;
  for (const value of report.integrityIssueCodes) {
    if (typeof value !== "string") throw new Error("HYBRID_FINANCE_WORKLIST_UNTRUSTED_ISSUES");
    if (Object.hasOwn(INTEGRITY, value)) unique.add(value);
    else unknown++;
  }
  if (unique.size + unknown !== report.integrityIssueCount) {
    throw new Error("HYBRID_FINANCE_WORKLIST_DUPLICATE_ISSUES");
  }
  // Invariance check prevents callers from replacing the mandatory release
  // blockers with user-crafted "all clear" data.
  if (!REQUIRED.every(([code]) => report.blockers.includes(code))) {
    throw new Error("HYBRID_FINANCE_WORKLIST_REQUIRED_BLOCKER_MISSING");
  }

  const items = REQUIRED.map(([code, category, th, en]) =>
    blocker(code, category, th, en, "release_blocker"));
  for (const code of [...unique].sort()) {
    const [category, th] = INTEGRITY[code];
    items.push(blocker(code, category, th,
      "Finance must inspect the original server-side documents; do not approve settlement",
      "integrity_exception"));
  }
  if (unknown) {
    items.push(blocker("UNKNOWN_INTEGRITY_CODE", "forgery",
      "พบรหัสข้อผิดพลาดที่ไม่รู้จัก ต้องตรวจ Source และเอกสารต้นทางโดยผู้ดูแลระบบ",
      "Unknown integrity code. Validate the diagnostic implementation before review",
      "integrity_exception"));
  }
  return Object.freeze({
    kind: "hybrid_finance_review_worklist",
    mode: "demo_read_only",
    bankPaymentConfirmed: false,
    bankSourceAuthenticated: false,
    historicalBankCoverageVerified: false,
    settlementAllowed: false,
    releaseReady: false,
    writesPerformed: false,
    nonAtomicDiagnostic: true,
    itemCount: items.length,
    unknownIntegrityCodeCount: unknown,
    counts: Object.freeze(Object.fromEntries([
      ...EXPECTED.map(name => [name, report.counts[name]]),
      ["lalamoveWalletDeliveryRefundCredits",
        report.counts.lalamoveWalletDeliveryRefundCredits],
    ])),
    items: Object.freeze(items),
  });
}

function formatHybridFinanceWorklistTH(worklist) {
  if (!worklist || worklist.kind !== "hybrid_finance_review_worklist"
    || worklist.settlementAllowed !== false || worklist.releaseReady !== false
    || !Array.isArray(worklist.items)) {
    throw new Error("HYBRID_FINANCE_WORKLIST_OUTPUT_INVALID");
  }
  const lines = [
    "PENGUIN • HYBRID BILLING FINANCE REVIEW • DEMO ONLY",
    "สถานะ: ห้ามยืนยันคืนเงินจริง / ห้ามเปิด Production / ยังไม่ยืนยันธนาคาร",
    "ผลตรวจ: บันทึกข้อผิดปกติสำหรับให้ฝ่ายการเงินตรวจเท่านั้น",
    "ไม่ใช่รายงานยอดชำระหรือหลักฐานการคืนเงินจากธนาคาร",
    "",
    "รายการที่ฝ่ายการเงินต้องตรวจ:",
  ];
  for (const [index, item] of worklist.items.entries()) {
    lines.push(
      (index + 1) + ". [" + item.severity + "] " + item.code,
      "   " + item.category + ": " + item.actionTH,
    );
  }
  lines.push("", "จำนวนเอกสารที่พบใน Firestore Emulator:");
  for (const [source, count] of Object.entries(worklist.counts)) {
    lines.push("  " + source + ": " + count);
  }
  lines.push("", "ยืนยัน Settlement: ไม่ได้", "สิ้นสุดรายงาน DEMO");
  return lines.join("\n") + "\n";
}
module.exports = {
  buildDemoHybridFinanceWorklist, formatHybridFinanceWorklistTH,
};
