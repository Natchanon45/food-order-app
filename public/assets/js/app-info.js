export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.11.4',
  build: '2026.06.29.041',
  branch: 'feature/retail-pos',
  commit: 'a11de2c',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B018 Icon Style Restore',
  updatedAt: '2026-06-29T20:45:00+07:00',
  whatsNew: [
    'restore icons.css ให้ครบจาก Branch main',
    'แก้ปุ่มและ user profile ที่พังจาก cache รอบก่อน',
    'คงตำแหน่ง toast แบบ Branch main'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
