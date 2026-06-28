export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.0',
  build: '2026.06.28.006',
  branch: 'feature/retail-pos',
  commit: '47a6710',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'M3-B006 Compact POS Polish',
  updatedAt: '2026-06-28T18:05:00+07:00',
  whatsNew: [
    'ปรับ Product Grid บน Desktop ให้ compact และไม่ยืดใหญ่เกิน',
    'คง Desktop Layout 2 คอลัมน์เพื่อให้ Cart อยู่ด้านขวาใช้งานง่าย',
    'ลดขนาดตัวอักษร placeholder ของสินค้าที่ไม่มีรูป',
    'หลีกเลี่ยง CSS force-mobile ที่ทำให้ Layout เพี้ยน'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
