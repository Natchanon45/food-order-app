export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.24',
  build: '2026.07.09.005',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-RETRY-BUTTON-01424',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Retry Button State',
  updatedAt: '2026-07-09T00:00:00+07:00',
  whatsNew: [
    'Disable the tax invoice ลอง Sync button while retry is running',
    'Show กำลัง Sync... during manual tax invoice sync retry',
    'Reuse the existing tax invoice history refresh and pending sync flow',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
