export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.12',
  build: '2026.07.31.094',
  branch: 'feature/retail-pos',
  commit: 'RETAIL-NATIVE-DIALOG-REPLACEMENT-01512',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail Native Dialog Replacement',
  updatedAt: '2026-07-31T23:35:00+07:00',
  whatsNew: [
    'Replace native alerts and confirmations in stock movement, purchasing, customers, and settings',
    'Use the shared styled dialog with explicit warning, cancel, and confirmation actions',
    'Show a green check-circle icon when a permission group can be selected in full'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
