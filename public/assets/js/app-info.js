export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.46',
  build: '2026.07.12.005',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-COPY-VIEW-LINK-01446',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Copy View Link',
  updatedAt: '2026-07-12T00:00:00+07:00',
  whatsNew: [
    'Add คัดลอกลิงก์มุมมอง to tax invoice history',
    'Copy the current search and filter URL for support handoff',
    'Keep copied view links client-side and display-only with no data writes',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
