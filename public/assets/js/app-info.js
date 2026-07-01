export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.34',
  build: '2026.07.01.016',
  branch: 'feature/retail-pos',
  commit: 'UI-016',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Cashier Load Fix',
  updatedAt: '2026-07-01T16:35:00+07:00',
  whatsNew: ['Fix cashier page loading']
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
