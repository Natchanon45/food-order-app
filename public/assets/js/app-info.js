export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.45',
  build: '2026.07.12.004',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-HISTORY-URL-STATE-01445',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync History URL State',
  updatedAt: '2026-07-12T00:00:00+07:00',
  whatsNew: [
    'Keep tax invoice history URL synced with search and filters',
    'Let staff copy the address bar for the current recovery view',
    'Keep history URL state client-side and display-only with no data writes',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
