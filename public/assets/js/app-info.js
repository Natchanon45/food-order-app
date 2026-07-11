export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.36',
  build: '2026.07.11.006',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-QUALITY-HINTS-01436',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Quality Hints',
  updatedAt: '2026-07-11T00:00:00+07:00',
  whatsNew: [
    'Add ตรวจข้อมูล quality hints for retryable tax invoice sync states',
    'Show a live ตรวจข้อมูล filter count and searchable warning text',
    'Include Quality Check in copied tax invoice sync recovery packages',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
