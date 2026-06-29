export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.11.1',
  build: '2026.06.29.038',
  branch: 'feature/retail-pos',
  commit: '254b504',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B015 POS Firebase Backup',
  updatedAt: '2026-06-29T16:15:00+07:00',
  whatsNew: [
    'Backup อ่านข้อมูลจาก Firebase tenant',
    'Restore เขียนข้อมูลกลับ Firebase tenant',
    'localStorage ใช้เป็น cache/fallback'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
