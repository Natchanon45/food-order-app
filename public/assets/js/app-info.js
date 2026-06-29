export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.10.3',
  build: '2026.06.29.030',
  branch: 'feature/retail-pos',
  commit: 'cdfc6e1',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B007 Tenant Customer Loyalty',
  updatedAt: '2026-06-29T10:10:00+07:00',
  whatsNew: [
    'บันทึกทะเบียนลูกค้าที่ tenants/{tenantId}/customers แบบ Firestore-first',
    'บันทึก customer tag ลง sale ตั้งแต่ transaction ปิดการขาย',
    'บันทึกลูกค้า sale และ loyalty ledger เป็น atomic batch'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
