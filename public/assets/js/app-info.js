export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.39',
  build: '2026.07.11.009',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-SOURCE-FILTERS-01439',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Source Filters',
  updatedAt: '2026-07-11T00:00:00+07:00',
  whatsNew: [
    'Add source filter chips to tax invoice history',
    'Show live counts for Firestore, เครื่องนี้, and both-source invoice rows',
    'Combine source filtering with existing sync filters and search',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
