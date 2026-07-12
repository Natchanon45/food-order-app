export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.44',
  build: '2026.07.12.003',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-FILTER-DEEP-LINK-01444',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Filter Deep Link',
  updatedAt: '2026-07-12T00:00:00+07:00',
  whatsNew: [
    'Add tax invoice history sync/source filter deep links for support recovery',
    'Include filtered Tax History URL in คัดลอก Sync recovery text',
    'Keep filter deep links client-side and display-only with no data writes',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
