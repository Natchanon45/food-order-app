export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.64',
  build: '2026.07.15.007',
  branch: 'feature/retail-pos',
  commit: 'POS-SYNC-DRAIN-SAFE-CONFIRM-01464',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Sync Drain Safe Confirm',
  updatedAt: '2026-07-15T14:58:00+07:00',
  whatsNew: [
    'Let normal POS checkout use the canonical online Firestore transaction flow instead of the safe-confirm fallback',
    'Keep safe-confirm as an explicit emergency fallback only when enabled by data attribute or page flag',
    'Drain large offline sale queues through repeated short sync batches until the queue clears',
    'Keep stable saleId, duplicate protection, stock safety, VAT, payments, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
