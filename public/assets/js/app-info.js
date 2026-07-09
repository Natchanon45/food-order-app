export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.20',
  build: '2026.07.09.001',
  branch: 'feature/retail-pos',
  commit: 'TAX-PROFILE-DELETE-SYNC-01420',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Buyer Profile Delete Sync',
  updatedAt: '2026-07-09T00:00:00+07:00',
  whatsNew: [
    'Remember deleted tax buyer profiles locally while offline',
    'Sync pending tax buyer profile deletions to tenant-scoped Firestore when online',
    'Prevent older remote tax buyer profiles from reappearing after local deletion',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
