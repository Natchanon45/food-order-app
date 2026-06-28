export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.0',
  build: '2026.06.28.003',
  branch: 'feature/retail-pos',
  commit: '55b164e',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'M3-B004 Developer Panel',
  updatedAt: '2026-06-28T17:05:00+07:00',
  whatsNew: [
    'เพิ่ม Developer Panel สำหรับดูข้อมูลระบบจากหน้า POS',
    'แสดง Version, Build, Branch, Commit และ Firebase Project',
    'เพิ่มข้อมูล Browser, Screen, URL และ Local Storage Cache',
    'เปิดได้จากการกด Version Badge หรือ Ctrl/⌘ + Shift + D'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
