export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.11.0',
  build: '2026.06.29.037',
  branch: 'feature/retail-pos',
  commit: '65212be',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B014 POS Users Roles',
  updatedAt: '2026-06-29T15:55:00+07:00',
  whatsNew: [
    'บันทึก POS roles ไป Firebase',
    'บันทึก POS users ไป Firebase',
    'localStorage เหลือเป็น cache'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
