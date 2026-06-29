export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.11.6',
  build: '2026.06.29.043',
  branch: 'feature/retail-pos',
  commit: '1e940e1',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B020 Horizontal Scroll Restore',
  updatedAt: '2026-06-29T21:25:00+07:00',
  whatsNew: [
    'restore mouse wheel horizontal scroll',
    'restore mouse drag horizontal scroll',
    'รองรับ POS tabs และ sales chart'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
