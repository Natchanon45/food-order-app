export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.51',
  build: '2026.07.12.010',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-HEALTH-SHORTCUTS-01451',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Health Shortcuts',
  updatedAt: '2026-07-12T00:00:00+07:00',
  whatsNew: [
    'Make tax invoice sync health chips clickable filter shortcuts',
    'Let status chips apply Sync Error, pending, stale, and review filters',
    'Let source chips filter Firestore-only, local-only, both-source, or all rows',
    'Preserve tax invoice create and void transactions, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
