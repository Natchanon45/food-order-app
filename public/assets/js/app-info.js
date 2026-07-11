export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.35',
  build: '2026.07.11.005',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-BUYER-RECOVERY-01435',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Buyer Recovery',
  updatedAt: '2026-07-11T00:00:00+07:00',
  whatsNew: [
    'Add แก้ผู้ซื้อ on local and pending create tax invoice history cards',
    'Save buyer recovery edits only to the local tax invoice cache',
    'Retry buyer recovery through the existing transaction-safe sync flow',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
