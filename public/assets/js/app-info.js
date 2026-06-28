export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.2',
  build: '2026.06.28.017',
  branch: 'feature/retail-pos',
  commit: '26fe613',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P6-B003 Offline Sale Fallback',
  updatedAt: '2026-06-28T22:30:00+07:00',
  whatsNew: [
    'แก้ POS ให้บันทึกการขายแบบออฟไลน์เมื่อปิดอินเทอร์เน็ต',
    'Firebase network fail จะ fallback ไป local sale อัตโนมัติ',
    'หน้าสั่งอาหารโต๊ะและ Delivery ยังเป็น Online เท่านั้น'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
