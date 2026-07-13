export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.54',
  build: '2026.07.13.002',
  branch: 'feature/retail-pos',
  commit: 'TAX-PROFILE-SYNC-DIAGNOSTICS-01454',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Profile Sync Diagnostics',
  updatedAt: '2026-07-13T00:00:00+07:00',
  whatsNew: [
    'Record sync diagnostics when direct tax buyer profile saves fail',
    'Show concise profile sync errors and attempt counts in the tax profile dialog',
    'Clear profile sync errors after direct save or profile sync succeeds',
    'Preserve tax invoice create and void transactions, VAT, payment, stock, and duplicate protection'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
