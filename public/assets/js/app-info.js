export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.10.2',
  build: '2026.06.29.027',
  branch: 'feature/retail-pos',
  commit: '0e4022b',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B006 Tenant Held Bills',
  updatedAt: '2026-06-29T09:05:00+07:00',
  whatsNew: [
    'บันทึกบิลพัก POS ใต้ tenants/{tenantId}/heldBills',
    'เพิ่ม migration จาก local held bills ไป Firebase',
    'คง localStorage เป็น cache/fallback เท่านั้น'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
