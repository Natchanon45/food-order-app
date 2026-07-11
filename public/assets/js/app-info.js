export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.41',
  build: '2026.07.11.011',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-SOURCE-FILTER-LABELS-01441',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Source Filter Labels',
  updatedAt: '2026-07-11T00:00:00+07:00',
  whatsNew: [
    'Rename source filter chips to Firestore เท่านั้น and เครื่องนี้เท่านั้น',
    'Show the clearer source filter label in the tax invoice history summary',
    'Keep source filter counts and behavior unchanged as UI-only',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
