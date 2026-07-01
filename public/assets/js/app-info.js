export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.50',
  build: '2026.07.02.004',
  branch: 'feature/retail-pos',
  commit: 'POS-OFFLINE-QUEUE-004',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B004 Offline Queue Worker + Retry + Conflict Resolver',
  updatedAt: '2026-07-02T00:00:00+07:00',
  whatsNew: [
    'Upgrade POS offline sale sync to use the central counter service',
    'Add offline queue worker state events for scheduled, syncing, failed, conflict, and offline states',
    'Keep Stable saleId and duplicate protection when retrying offline sync',
    'Improve conflict retry/discard resolver metadata for local offline sales'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
