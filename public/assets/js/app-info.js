export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.32',
  build: '2026.07.11.002',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-STALE-HINT-01432',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Stale Hint',
  updatedAt: '2026-07-11T00:00:00+07:00',
  whatsNew: [
    'Show ค้าง Sync on retryable tax invoice sync states older than 24 hours',
    'Add stale sync age and reference time to tax invoice recovery copy packages',
    'Keep stale sync hints display-only without adding a new Firestore write path',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
