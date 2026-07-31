export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.10',
  build: '2026.07.31.092',
  branch: 'feature/retail-pos',
  commit: 'SALES-NET-CARD-CONTRAST-01510',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Sales Net Card Contrast',
  updatedAt: '2026-07-31T18:05:00+07:00',
  whatsNew: [
    'Restore the primary green background of the net-sales summary card',
    'Render the net-sales label, amount, and unit in high-contrast white',
    'Keep the remaining report summary cards and sales calculations unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
