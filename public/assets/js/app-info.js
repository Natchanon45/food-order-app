export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.30',
  build: '2026.07.10.005',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-FILTERS-01430',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Filters',
  updatedAt: '2026-07-10T00:00:00+07:00',
  whatsNew: [
    'Add tax invoice history filters for all, Sync Error, pending sync, and ส่ง Support',
    'Show live counts on each tax invoice sync filter chip',
    'Keep tax invoice sync filtering display-only without adding a new Firestore write path',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
