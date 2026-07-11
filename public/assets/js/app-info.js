export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.37',
  build: '2026.07.11.007',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-RECOVERY-ACTION-01437',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Recovery Action',
  updatedAt: '2026-07-11T00:00:00+07:00',
  whatsNew: [
    'Add คำแนะนำ recovery guidance for retryable tax invoice sync states',
    'Include Recommended Action in copied tax invoice sync recovery packages',
    'Keep recovery recommendations display-only without adding a Firestore write path',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
