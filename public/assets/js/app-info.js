export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.10.8',
  build: '2026.06.29.035',
  branch: 'feature/retail-pos',
  commit: 'db6b9dc',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B012 POS Final Data Audit',
  updatedAt: '2026-06-29T15:15:00+07:00',
  whatsNew: [
    'ถอด loader ใบเสร็จซ้ำที่ยัง hardcode ข้อมูลร้าน',
    'hydrate POS roles จาก tenants/{tenantId}/roles ตอน login',
    'ตรวจ catalog, receipt loyalty และ permission guard แล้วว่าไม่เขียน business data ใหม่'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
