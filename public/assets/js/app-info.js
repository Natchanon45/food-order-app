export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.33',
  build: '2026.07.11.003',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-STALE-FILTER-01433',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Stale Filter',
  updatedAt: '2026-07-11T00:00:00+07:00',
  whatsNew: [
    'Add a ค้าง Sync filter chip for stale retryable tax invoice sync states',
    'Show live stale sync counts beside the existing tax invoice sync filters',
    'Keep stale sync filtering display-only without adding a new Firestore write path',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
