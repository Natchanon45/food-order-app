export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.31',
  build: '2026.07.11.001',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-PENDING-COPY-01431',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Pending Copy',
  updatedAt: '2026-07-11T00:00:00+07:00',
  whatsNew: [
    'Show คัดลอก Sync on pending and local tax invoice sync states before an error appears',
    'Copy a tax invoice sync recovery package for support handoff from retryable cards',
    'Keep pending sync recovery copy display-only without adding a new Firestore write path',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
