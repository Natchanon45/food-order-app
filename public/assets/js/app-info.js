export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.42',
  build: '2026.07.12.001',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-CLEAR-FILTERS-01442',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Clear Filters',
  updatedAt: '2026-07-12T00:00:00+07:00',
  whatsNew: [
    'Add ล้างตัวกรอง in empty tax invoice history filter results',
    'Reset search, sync status filter, and source filter back to all rows',
    'Keep clear-filter behavior display-only with no data writes',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
