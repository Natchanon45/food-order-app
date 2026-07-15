export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.62',
  build: '2026.07.15.005',
  branch: 'feature/retail-pos',
  commit: 'POS-OFFLINE-RECONCILE-01462',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Offline Sync Reconcile',
  updatedAt: '2026-07-15T10:25:00+07:00',
  whatsNew: [
    'Reconcile queued local POS sales with existing Firestore sales before retrying offline sync',
    'Mark already-synced local sales with firebaseSyncedAt, offlineSyncHash, syncHashVersion, and clean queue metadata',
    'Remove reconciled sales from the POS sync badge and worker queue on reload',
    'Keep stable saleId, duplicate protection, stock safety, VAT, payments, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
