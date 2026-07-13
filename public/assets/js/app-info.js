export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.53',
  build: '2026.07.13.001',
  branch: 'feature/retail-pos',
  commit: 'TAX-PROFILE-DIRECT-SYNC-01453',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Profile Direct Sync',
  updatedAt: '2026-07-13T00:00:00+07:00',
  whatsNew: [
    'Update local tax buyer profile sync badges after direct Firestore saves succeed',
    'Keep failed or offline buyer profile saves pending for the existing profile sync worker',
    'Use firebaseSyncedAt for direct-save and profile-sync success visibility',
    'Preserve tax invoice create and void transactions, VAT, payment, stock, and duplicate protection'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
