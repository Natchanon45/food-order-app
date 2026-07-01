export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.33',
  build: '2026.07.01.015',
  branch: 'feature/retail-pos',
  commit: 'UI-ICONS-015',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Cashier Icons',
  updatedAt: '2026-07-01T16:25:00+07:00',
  whatsNew: [
    'Cashier table payment uses check-circle',
    'User menu table QR uses easel2',
    'Table move uses easel2',
    'Cache versions updated'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
