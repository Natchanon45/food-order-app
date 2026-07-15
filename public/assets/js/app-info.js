export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.63',
  build: '2026.07.15.006',
  branch: 'feature/retail-pos',
  commit: 'POS-SYNC-MARKER-AUTHORITY-01463',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Sync Marker Authority',
  updatedAt: '2026-07-15T10:50:00+07:00',
  whatsNew: [
    'Keep local POS sales with synced markers out of the offline queue after reload',
    'Refresh diagnostic sync hashes without turning already-synced sales back to pending',
    'Count only completed sync-eligible sales in the POS sync badge and leave the worker idle when the queue is empty',
    'Keep stable saleId, duplicate protection, stock safety, VAT, payments, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
