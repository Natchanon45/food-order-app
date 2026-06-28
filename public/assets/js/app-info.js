export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.1',
  build: '2026.06.28.016',
  branch: 'feature/retail-pos',
  commit: '0eae79e',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P6-B002 Offline Cashier/POS Scope',
  updatedAt: '2026-06-28T22:15:00+07:00',
  whatsNew: [
    'เพิ่ม Offline Data Layer สำหรับฝั่งแคชเชียร์ / POS',
    'เพิ่ม IndexedDB store และ sync queue สำหรับข้อมูลขายหน้าร้าน',
    'คงหน้าสั่งอาหารโต๊ะให้ Online เท่านั้นเพื่อเห็นออเดอร์ร่วมและออเดอร์ก่อนหน้าแบบสด',
    'คง Delivery ให้ Online เท่านั้นตาม workflow เดิม'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
