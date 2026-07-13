export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.57',
  build: '2026.07.13.005',
  branch: 'feature/retail-pos',
  commit: 'UI-FONT-WEIGHT-SWEEP-01457',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'System UI Font Weight Sweep',
  updatedAt: '2026-07-13T10:20:00+07:00',
  whatsNew: [
    'Sweep remaining hardcoded heavy UI font weights in Order/Delivery and Retail POS surfaces',
    'Reduce mobile cart, admin dialogs, sales report, product management, catalog, and Customer Display text to the 500-600 range',
    'Refresh CSS and JS cache versions so browsers load the lighter UI assets',
    'Keep printable receipt and tax invoice paper font behavior unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
