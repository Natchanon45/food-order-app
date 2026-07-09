export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.26',
  build: '2026.07.10.001',
  branch: 'feature/retail-pos',
  commit: 'TAX-VOID-VALIDATION-01426',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Void Transaction Validation',
  updatedAt: '2026-07-10T00:00:00+07:00',
  whatsNew: [
    'Validate remote tax invoice tenant before online void writes',
    'Check invoice number and source sale identity when available before voiding',
    'Stop mismatched voids instead of falling back to a local pending void',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
