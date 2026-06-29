export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.7',
  build: '2026.06.29.022',
  branch: 'feature/retail-pos',
  commit: '407a5b3',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B001 Tenant Firebase Sync',
  updatedAt: '2026-06-29T07:45:00+07:00',
  whatsNew: [
    'เพิ่ม sync รายการขาย offline กลับ tenant Firebase',
    'บันทึก sales และ stockMovements ใต้ tenants/{tenantId}',
    'คง localStorage เป็น fallback/cache เท่านั้น'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
