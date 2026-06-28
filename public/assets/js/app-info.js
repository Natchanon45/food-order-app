export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.0',
  build: '2026.06.28.012',
  branch: 'feature/retail-pos',
  commit: '62ad377',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P4-B003R Developer Dot Polish',
  updatedAt: '2026-06-28T19:34:00+07:00',
  whatsNew: [
    'แก้ Developer Dot ให้เป็นจุดกลมล้วน ไม่มีคำว่า DEV โผล่',
    'ขยับตำแหน่ง Dot ให้อยู่ใน Safe Area บนมือถือ',
    'ลดขนาดและความทึบของ Dot เพื่อไม่รบกวนยอดรวม/ปุ่มขาย',
    'ยังคงกด Dot เพื่อเปิด Developer Panel ได้เหมือนเดิม'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
