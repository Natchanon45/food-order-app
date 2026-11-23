// Strict read-only Superadmin Access Evidence contract.
// The Source Go HMAC / bank / cash / hold registry does not exist in Firebase.
// No response field here is permission to toggle a storefront or mark Paid.
export const ACCESS_REASONS=Object.freeze({
 TENANT_INACTIVE:"ทะเบียนร้านระบุว่ายังไม่เปิดใช้งาน",
 MANUAL_SECURITY_SUSPENSION:"มีเหตุระงับจากผู้ดูแลหรือความปลอดภัย",
 LEGACY_MEMBERSHIP_SUSPENDED:"สถานะสมาชิกเดิมถูกระงับหรือหมดอายุ",
 LEGACY_MEMBERSHIP_EXPIRED:"สมาชิกเลยวันสิ้นสุดและวันผ่อนผัน",
 LEGACY_DELIVERY_SHARE_HOLD:"ระบบเดิมระงับจากส่วนแบ่ง Delivery",
 HYBRID_BILLING_HOLD:"พบการระงับจาก Hybrid Billing เดิม",
 M7_RECORDED_HOLD_UNVERIFIED:"มีค่าระงับ M7 ในทะเบียนร้าน แต่ไม่มีลายเซ็น Source รับรอง",
 M7_FINANCE_REVIEW_REQUIRED:"สถานะการเงิน M7 ต้องตรวจสอบเพิ่มเติม",
 TEST_OVERRIDE_METADATA_ONLY:"มีค่าทดสอบการเปิด/ระงับ ไม่ใช่สิทธิ์ที่ตรวจยืนยัน",
 TEST_OVERRIDE_MALFORMED:"ค่าโหมดทดสอบไม่ถูกต้อง ต้องตรวจสอบ",
 FINANCIAL_STATE_UNKNOWN:"ค่าสถานะการเงินไม่อยู่ในชุดที่รองรับ",
 TENANT_SLUG_INDEX_MISSING:"ไม่พบทะเบียน Slug สำหรับจับคู่สิทธิ์ของร้าน",
 TENANT_SLUG_INDEX_CONFLICT:"Tenant กับทะเบียน Slug ระบุสถานะไม่ตรงกัน",
 MEMBERSHIP_EXPIRY_MISSING:"ไม่มีวันหมดอายุสมาชิกเดิมที่ยืนยันได้",
 MEMBERSHIP_GRACE_INVALID:"จำนวนวันผ่อนผันของสมาชิกไม่ถูกต้อง",
 MEMBERSHIP_STATUS_UNKNOWN:"สถานะสมาชิกไม่อยู่ในรูปแบบที่รองรับ",
 ORIGINAL_ACTIVATION_UNVERIFIED:"ข้อมูลเปิดใช้งานครั้งแรกหรือ Owner ยังไม่ครบ",
});
export const SOURCE_GAPS=Object.freeze({
 GO_SIGNED_HOLD_APPROVAL_NOT_AVAILABLE:"ลายเซ็นอนุมัติ Hold จาก Go/SQL ต้นฉบับ",
 SOURCE_IMMUTABLE_INVOICE_JOURNAL_NOT_AVAILABLE:"ทะเบียน Invoice ต้นฉบับพร้อมหลักฐานที่แก้ไขไม่ได้",
 INDEPENDENT_BANK_STATEMENT_NOT_AVAILABLE:"หลักฐานธนาคารอิสระยืนยันการรับชำระ",
 SOURCE_CREDIT_LEDGER_NOT_AVAILABLE:"ทะเบียน Service Credit ต้นฉบับพร้อมประวัติรายการ",
 SOURCE_MANUAL_SECURITY_HOLD_LEDGER_NOT_AVAILABLE:"หลักฐานการระงับด้านความปลอดภัยที่ตรวจสอบแยกได้",
});
const STATES=new Set([
 "recorded_restriction","review_required","no_recorded_restriction_unverified",
]);
const FALSE_FIELDS=[
 "sourceOriginalHoldSignatureVerified",
 "independentBankCashVerified",
 "originalInvoiceJournalCertified",
 "sourceCreditLedgerCertified","financialBalanceKnown",
 "canReleaseTenant","canSettleMoney","canIssueInvoice",
 "canApplyCredit","writesPerformed",
];
export function validateTenantAccessEvidence(data,tenantId){
 if(!data||typeof data!=="object"||Array.isArray(data)||
  data.ok!==true||data.readOnly!==true||
  data.authenticated!==true||data.superadminOnly!==true||
  data.mode!=="p12e_source_access_evidence_triage"||
  data.tenantId!==tenantId||
  !/^[a-f0-9]{64}$/.test(data.snapshotDigest||"")||
  !STATES.has(data.state)||data.canSell!==null||
  data.certifiedOpenInvoiceCount!==null||
  data.certifiedOutstandingCents!==null||
  typeof data.tenantSlugCoherent!=="boolean"||
  FALSE_FIELDS.some(field=>data[field]!==false)||
  !Array.isArray(data.reasonCodes)||data.reasonCodes.length>20||
  data.reasonCodes.some((reason,index)=>
   !Object.hasOwn(ACCESS_REASONS,reason)||
   index>0&&reason<=data.reasonCodes[index-1])||
  !Array.isArray(data.sourceProofGaps)||
  data.sourceProofGaps.length!==Object.keys(SOURCE_GAPS).length||
  data.sourceProofGaps.some((gap,index)=>
   !Object.hasOwn(SOURCE_GAPS,gap)||data.sourceProofGaps.indexOf(gap)!==index)||
  typeof data.recordedM7State!=="string"||data.recordedM7State.length>60||
  typeof data.testOverrideRecorded!=="string"||
  data.testOverrideRecorded.length>20)
  throw new Error("TENANT_ACCESS_EVIDENCE_UNVERIFIED");
 return data;
}
export const summaryText=(state)=>{
 if(state==="recorded_restriction")
  return "พบสถานะระงับในข้อมูลร้าน (ยังไม่มีหลักฐาน Source รับรอง)";
 if(state==="review_required")
  return "ข้อมูลสิทธิ์ไม่สอดคล้อง ต้องตรวจสอบหลักฐานเพิ่มเติม";
 return "ยังไม่พบค่าระงับในทะเบียนที่อ่านได้ แต่ยังยืนยันสิทธิ์ขายจริงไม่ได้";
};
