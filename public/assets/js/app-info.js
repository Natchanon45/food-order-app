export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.11.2',
  build: '2026.06.29.039',
  branch: 'feature/retail-pos',
  commit: 'db279e4',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B016 POS Sales Report',
  updatedAt: '2026-06-29T16:35:00+07:00',
  whatsNew: [
    'รายงานขายอ่านจาก Firebase tenant',
    'ใบเสร็จรายงานขายอ่าน settings จาก Firebase',
    'localStorage ใช้เป็น cache'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
