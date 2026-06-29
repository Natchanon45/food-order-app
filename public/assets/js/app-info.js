export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.5',
  build: '2026.06.29.020',
  branch: 'feature/retail-pos',
  commit: '05f7003',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P6-B006 Mobile Cart Checkout Action',
  updatedAt: '2026-06-29T07:20:00+07:00',
  whatsNew: [
    'หลังเปิดดูบิลแล้ว ปุ่มตะกร้าล่างเปลี่ยนเป็นรับชำระเงิน',
    'กดปุ่มเดียวกันซ้ำเพื่อเปิดหน้ารับชำระเงินทันที',
    'ไม่ต้องเลื่อนหา footer ชำระเงินใน drawer'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
