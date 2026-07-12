export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.52',
  build: '2026.07.12.011',
  branch: 'feature/retail-pos',
  commit: 'TAX-PROFILE-SYNC-BADGES-01452',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Profile Sync Badges',
  updatedAt: '2026-07-12T00:00:00+07:00',
  whatsNew: [
    'Show sync status badges in the tax buyer profile dialog',
    'Mark newly saved tax buyer profiles as pending sync until Firestore profile sync succeeds',
    'Record firebaseSyncedAt for successfully synced buyer tax profiles',
    'Preserve tax invoice create and void transactions, VAT, payment, stock, and duplicate protection'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
