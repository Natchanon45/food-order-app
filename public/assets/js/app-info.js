export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.34',
  build: '2026.07.11.004',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-SOURCE-RECEIPT-01434',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Source Receipt',
  updatedAt: '2026-07-11T00:00:00+07:00',
  whatsNew: [
    'Add ดูบิลต้นทาง on tax invoice history cards with source sale references',
    'Include Source Receipt in copied tax invoice sync recovery packages',
    'Keep source receipt recovery read-only without adding a new Firestore write path',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
