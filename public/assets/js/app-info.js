export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.42',
  build: '2026.07.01.024',
  branch: 'feature/retail-pos',
  commit: 'TABLE-MOVE-024',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Table Move Customer Session Fix',
  updatedAt: '2026-07-01T21:55:00+07:00',
  whatsNew: [
    'Keep customer table session continuous after Cashier table move',
    'Show previous rounds by stable tableToken after moving table',
    'Send new customer orders to the active moved table',
    'Bump customer order page cache version'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
