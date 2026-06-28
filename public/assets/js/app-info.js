export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.0',
  build: '2026.06.28.014',
  branch: 'feature/retail-pos',
  commit: '7ebc32b',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P5-B001 Skeleton Loading',
  updatedAt: '2026-06-28T20:15:00+07:00',
  whatsNew: [
    'เพิ่ม Skeleton Loading ให้ Product Grid ระหว่างโหลดสินค้า',
    'แสดง placeholder แบบ shimmer แทนพื้นที่ว่าง',
    'ซ่อน skeleton อัตโนมัติเมื่อสินค้าโหลดเสร็จ',
    'รองรับ Mobile/Desktop และลด animation ตาม prefers-reduced-motion'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
