export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.3',
  build: '2026.06.29.018',
  branch: 'feature/retail-pos',
  commit: 'a714ce5',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P6-B004 Version Badge CSS Lock',
  updatedAt: '2026-06-29T06:45:00+07:00',
  whatsNew: [
    'ล็อกขนาดปุ่ม Developer Badge ให้ไม่มี padding แทรกกลับมา',
    'จัดจุดสีขาวให้อยู่กึ่งกลางด้วย grid และ fixed square size',
    'คง Offline Sale Fallback ของ POS จาก build ก่อนหน้า'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
