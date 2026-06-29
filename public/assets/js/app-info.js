export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.11.3',
  build: '2026.06.29.040',
  branch: 'feature/retail-pos',
  commit: '8049244',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B017 Table Delivery Toast',
  updatedAt: '2026-06-29T16:50:00+07:00',
  whatsNew: [
    'คืนตำแหน่ง toast แบบ Branch main',
    'ปรับเฉพาะ Table Order และ Delivery',
    'Retail POS ยังใช้ toast แยกของ POS'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
