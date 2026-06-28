export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.0',
  build: '2026.06.28.002',
  branch: 'feature/retail-pos',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  updatedAt: '2026-06-28T16:40:00+07:00'
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
