export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.0',
  build: '2026.06.28.004',
  branch: 'feature/retail-pos',
  commit: 'a67bf8c',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'M3-B005 Unified Mobile Shell',
  updatedAt: '2026-06-28T17:35:00+07:00',
  whatsNew: [
    'ปรับ Desktop ให้ใช้ Mobile Layout กลางจอเหมือนกัน',
    'Product Grid ใช้ 2 คอลัมน์แบบมือถือ',
    'Cart ย้ายลงด้านล่างเหมือนมือถือเมื่อเปิดบน Desktop',
    'ลดความต่างของ Header, Search, Category และปุ่ม Action ระหว่าง Desktop/Mobile'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
