export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.23',
  build: '2026.07.09.004',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-RETRY-ACTION-01423',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Retry Action',
  updatedAt: '2026-07-09T00:00:00+07:00',
  whatsNew: [
    'Add a direct ลอง Sync action to tax invoice history cards with pending or error sync state',
    'Reuse the existing pending tax invoice and tax buyer profile sync flow from the retry action',
    'Keep retry action display-only until staff explicitly clicks it',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
