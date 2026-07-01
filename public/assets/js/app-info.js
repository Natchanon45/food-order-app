export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.46',
  build: '2026.07.01.029',
  branch: 'feature/retail-pos',
  commit: 'TABLE-MOVE-029',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Old QR Moved Orders & Admin Status Icons',
  updatedAt: '2026-07-01T23:10:00+07:00',
  whatsNew: [
    'Load old QR previous rounds from tableToken and movedFromTableCode',
    'Normalize moved-table orders for the customer previous rounds view',
    'Keep new orders from old QR going to the active moved table',
    'Use check-square and square icons for Admin menu/table active status'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
