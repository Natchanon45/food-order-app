export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.29',
  build: '2026.07.10.004',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-ESCALATION-HINT-01429',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Escalation Hint',
  updatedAt: '2026-07-10T00:00:00+07:00',
  whatsNew: [
    'Show ส่ง Support on tax invoice sync errors after repeated failed attempts',
    'Add escalation guidance to tax invoice sync diagnostics',
    'Include escalation state in copied Sync support packages',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
