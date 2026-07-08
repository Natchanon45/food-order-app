export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.13',
  build: '2026.07.08.026',
  branch: 'feature/retail-pos',
  commit: 'POS-TAX-SYNC-ERROR-01413',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Full Tax Invoice Sync Error Visibility',
  updatedAt: '2026-07-08T00:00:00+07:00',
  whatsNew: [
    'Show full tax invoice pending sync errors in tax invoice history',
    'Refresh app-info cache chain through the POS toast/status loader',
    'Record sync attempts, sync error time, and concise sync error messages locally',
    'Keep full tax invoice offline void sync behavior unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
