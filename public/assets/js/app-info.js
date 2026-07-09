export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.25',
  build: '2026.07.09.006',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-SINGLE-FLIGHT-01425',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Single Flight',
  updatedAt: '2026-07-09T00:00:00+07:00',
  whatsNew: [
    'Guard pending full tax invoice sync with one in-flight promise per browser tab',
    'Make page load, online reconnect, receipt popup, and ลอง Sync share the same retry run',
    'Keep pending create and void retry on the existing transaction-safe sync flow',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
