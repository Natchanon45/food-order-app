export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.92',
  build: '2026.07.16.017',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-PERMISSION-LOCK-01492',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Permission And Cross Tab Lock',
  updatedAt: '2026-07-16T23:55:00+07:00',
  whatsNew: [
    'Allow tenant-scoped tax invoices, tax buyer profiles, TAX counters, and TAX running numbers in Firestore rules',
    'Stop automatic retry after permission-denied and require an explicit retry',
    'Prevent multiple tax history tabs from triggering each other in an endless sync loop'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
