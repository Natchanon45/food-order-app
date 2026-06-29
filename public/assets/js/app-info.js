export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.4',
  build: '2026.06.29.019',
  branch: 'feature/retail-pos',
  commit: '866e672',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P6-B005 Mobile Cart Restore',
  updatedAt: '2026-06-29T06:55:00+07:00',
  whatsNew: [
    'คืนปุ่มดูตะกร้าบนมือถือหลังหยิบสินค้าเข้าบิล',
    'คง CSS Developer Badge แบบไม่มี padding',
    'คง Offline Sale Fallback ของ POS'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
