export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.44',
  build: '2026.07.01.027',
  branch: 'feature/retail-pos',
  commit: 'TABLE-MOVE-027',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Customer Old QR Table Move Fix',
  updatedAt: '2026-07-01T22:25:00+07:00',
  whatsNew: [
    'Patch customer order page on the same data-service module used by customer.js',
    'Load previous table orders by stable tableToken after table move',
    'Normalize moved-table orders for the old QR view',
    'Bump customer order page cache version'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
