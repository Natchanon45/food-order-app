export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.19',
  build: '2026.07.08.032',
  branch: 'feature/retail-pos',
  commit: 'TAX-PROFILE-SYNC-01419',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Buyer Profile Sync',
  updatedAt: '2026-07-08T00:00:00+07:00',
  whatsNew: [
    'Sync tax buyer profiles with tenant-scoped Firestore data when online',
    'Keep tax buyer profiles available locally for offline invoice issuing',
    'Merge local and remote tax buyer profiles by stable profile ID',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
