export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.22',
  build: '2026.07.09.003',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-DIAGNOSTIC-VISIBILITY-01422',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Diagnostic Visibility',
  updatedAt: '2026-07-09T00:00:00+07:00',
  whatsNew: [
    'Show tax invoice sync attempt count in history cards',
    'Show the latest tax invoice sync attempt time beside Sync Error details',
    'Keep tax invoice sync diagnostics searchable and readable for staff',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
