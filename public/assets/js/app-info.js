export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.8',
  build: '2026.07.31.090',
  branch: 'feature/retail-pos',
  commit: 'ADMIN-USERS-LARAVEL-PARITY-01508',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Product Management Confirmation Dialogs',
  updatedAt: '2026-07-31T16:40:00+07:00',
  whatsNew: [
    'Replace browser-native product-management confirmations with the shared styled dialog',
    'Use explicit confirmation dialogs for product deletion, category deletion, and local stock-history clearing',
    'Show permission-denied feedback inside the application instead of a browser alert'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
