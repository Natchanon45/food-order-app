export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.0',
  build: '2026.06.28.009',
  branch: 'feature/retail-pos',
  commit: 'a1e3674',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P4-B001 Mobile Bottom Cart Bar',
  updatedAt: '2026-06-28T18:48:00+07:00',
  whatsNew: [
    'เพิ่มแถบตะกร้าด้านล่างบนมือถือเมื่อมีสินค้าในบิล',
    'แสดงจำนวนรายการและยอดสุทธิแบบเห็นได้ตลอด',
    'กดแถบตะกร้าเพื่อเลื่อนไปยังรายการขายได้ทันที',
    'ขยับ Version Badge บนมือถือไม่ให้ทับ Bottom Cart'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
