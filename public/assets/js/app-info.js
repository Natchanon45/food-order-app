export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.0',
  build: '2026.06.28.010',
  branch: 'feature/retail-pos',
  commit: '52e9008',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P4-B002 Floating Cart Drawer',
  updatedAt: '2026-06-28T19:02:00+07:00',
  whatsNew: [
    'กด Bottom Cart บนมือถือแล้วเปิด Floating Cart Drawer',
    'แสดงรายการสินค้า จำนวน และยอดรวมใน Drawer',
    'เพิ่มปุ่มรับชำระเงินใน Drawer',
    'ปัดลงหรือแตะพื้นหลังเพื่อปิด Drawer ได้'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
