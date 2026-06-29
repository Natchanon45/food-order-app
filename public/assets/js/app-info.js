export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.10.6',
  build: '2026.06.29.033',
  branch: 'feature/retail-pos',
  commit: '3a575bc',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B010 POS Receipt Store Settings',
  updatedAt: '2026-06-29T14:35:00+07:00',
  whatsNew: [
    'ใบเสร็จ POS อ่าน settings จาก tenants/{tenantId}/settings/receipt',
    'fallback ไป tenants/{tenantId}/settings/store และ cache ในเครื่อง',
    'localStorage สำหรับข้อมูลร้านเหลือเป็น cache เท่านั้น'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
