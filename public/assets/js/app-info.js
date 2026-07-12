export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.50',
  build: '2026.07.12.009',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-HEALTH-PANEL-01450',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Health Panel',
  updatedAt: '2026-07-12T00:00:00+07:00',
  whatsNew: [
    'Add a tax invoice sync health panel to the tax invoice history page',
    'Summarize Sync Error, pending, stale, quality review, and source counts',
    'Show concise pending invoice, buyer profile, and Firestore list load errors',
    'Preserve tax invoice create and void transactions, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
