export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.24',
  build: '2026.07.01.005',
  branch: 'feature/retail-pos',
  commit: 'O1-T001',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'O1-T001 Take Away Order / Pickup Queue',
  updatedAt: '2026-07-01T10:35:00+07:00',
  whatsNew: [
    'Add Take Away ordering page without opening a table',
    'Create daily TA queue number for pickup orders',
    'Add cashier pickup call and picked-up workflow',
    'Keep table QR, delivery, and POS flows separate'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
