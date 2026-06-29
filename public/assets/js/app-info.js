export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.10.3',
  build: '2026.06.29.029',
  branch: 'feature/retail-pos',
  commit: '94acac1',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B007 Tenant Customer Loyalty',
  updatedAt: '2026-06-29T09:25:00+07:00',
  whatsNew: [
    'โหลดลูกค้า POS จาก tenants/{tenantId}/customers',
    'บันทึก customer tag ใน sale กลับ Firebase',
    'บันทึก loyalty ledger ใต้ tenants/{tenantId}/loyaltyLedger'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
