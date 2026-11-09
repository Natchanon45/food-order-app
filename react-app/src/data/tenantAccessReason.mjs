// Authoritative reason labels. A legacy account expiry/security restriction
// is NOT proof of an M7 issued invoice, regardless of report context.
export const SIGNED_TENANT_ACCESS_REASONS = new Set([
  "none", "legacy_membership_expired", "legacy_membership_hold",
  "legacy_security_hold", "legacy_delivery_debt_hold", "tenant_inactive",
  "m7_invoice_hold", "superadmin_test_suspension",
]);

export function tenantAccessReasonLabel(reason) {
  switch (reason) {
    case "none": return "ใช้งานตามสิทธิ์";
    case "legacy_membership_expired": return "สิทธิ์สมาชิกเดิมหมดอายุ";
    case "legacy_membership_hold": return "ถูกระงับตามสถานะสมาชิกเดิม";
    case "legacy_security_hold": return "ระงับจากผู้ดูแล/ความปลอดภัย";
    case "legacy_delivery_debt_hold": return "ระงับจากส่วนแบ่งในระบบเดิม";
    case "tenant_inactive": return "ร้านค้ายังไม่ได้เปิดใช้งาน";
    case "m7_invoice_hold": return "ระงับจาก Invoice M7 ที่ยืนยันแล้ว";
    case "superadmin_test_suspension": return "ระงับโดย Superadmin (ทดสอบ)";
    default: return "ต้องตรวจสอบสิทธิ์ร้านค้า";
  }
}
