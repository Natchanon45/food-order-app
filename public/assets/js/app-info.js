export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.48',
  build: '2026.07.12.007',
  branch: 'feature/retail-pos',
  commit: 'TAX-PROFILE-DIALOG-VISUAL-REFRESH-01448',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Profile Dialog Visual Refresh',
  updatedAt: '2026-07-12T00:00:00+07:00',
  whatsNew: [
    'Refresh the tax invoice history white and green POS layout',
    'Widen the customer tax profile dialog with a profile sidebar and grouped fields',
    'Improve form focus, spacing, and the dialog action bar',
    'Preserve tax buyer profile storage, sync, invoice, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
