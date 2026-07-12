export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.49',
  build: '2026.07.12.008',
  branch: 'feature/retail-pos',
  commit: 'POS-OFFLINE-SYNC-SYNCED-FLAG-01449',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Offline Sync Synced Flag',
  updatedAt: '2026-07-12T00:00:00+07:00',
  whatsNew: [
    'Add offlineSyncHash for local POS sales that are already synced',
    'Backfill synced local sales so they stop appearing in the offline sync badge',
    'Skip only matching synced payloads, not blindly trusted boolean flags',
    'Preserve stable saleId, duplicate protection, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
