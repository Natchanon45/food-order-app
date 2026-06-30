export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.13',
  build: '2026.06.30.079',
  branch: 'feature/retail-pos',
  commit: 'P9-B004',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B004 Offline Queue Worker + Retry + Conflict Resolver',
  updatedAt: '2026-06-30T19:50:00+07:00',
  whatsNew: [
    'Add OfflineQueueWorker for automatic POS sync retries',
    'Add exponential retry delay for failed offline sales',
    'Add conflict metadata and resolver helpers for offline sales',
    'Wire manual Sync button to retry failed queue items'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
