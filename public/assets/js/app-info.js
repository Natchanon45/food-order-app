export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.27',
  build: '2026.07.10.002',
  branch: 'feature/retail-pos',
  commit: 'TAX-VOID-DIAGNOSTICS-01427',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Void Retry Diagnostics',
  updatedAt: '2026-07-10T00:00:00+07:00',
  whatsNew: [
    'Record sync action, phase, and target document for pending tax invoice sync errors',
    'Show create or void retry diagnostics in tax invoice history cards',
    'Allow searching tax invoices by sync action, phase, or target ID',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
