export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.38',
  build: '2026.07.11.008',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-SOURCE-VISIBILITY-01438',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Source Visibility',
  updatedAt: '2026-07-11T00:00:00+07:00',
  whatsNew: [
    'Show แหล่งข้อมูล on tax invoice history cards',
    'Include Data Source in copied tax invoice sync recovery packages',
    'Keep source labels display-only from loaded local and Firestore rows',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
