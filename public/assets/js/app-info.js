export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.0',
  build: '2026.06.28.005',
  branch: 'feature/retail-pos',
  commit: '44c3a72',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'M3-B005R POS Layout Rollback',
  updatedAt: '2026-06-28T17:52:00+07:00',
  whatsNew: [
    'ถอด Desktop Force Mobile Shell ที่ทำให้ Layout เพี้ยนออก',
    'คืนโครงสร้าง Desktop POS ให้กลับมาเป็น 2 คอลัมน์ใช้งานได้',
    'คง Product Grid แบบ Compact Card เดิมไว้',
    'เตรียมปรับ Layout รอบถัดไปแบบไม่ใช้ CSS Override หนัก'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
