export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.0',
  build: '2026.06.28.008',
  branch: 'feature/retail-pos',
  commit: '3e9c134',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'M3-B007R Mobile Overflow Fix',
  updatedAt: '2026-06-28T18:35:00+07:00',
  whatsNew: [
    'แก้ Mobile horizontal overflow ที่ทำให้เลื่อนหลุดไปพื้นที่ว่างด้านขวา',
    'ล็อก html/body/pos-layout/panel ไม่ให้กว้างเกินหน้าจอ',
    'บังคับ Product Grid และ Category Tabs ให้อยู่ใน viewport จริง',
    'คง Desktop Layout ที่ผ่านการทดสอบแล้วไว้เหมือนเดิม'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
