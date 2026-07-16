export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.89',
  build: '2026.07.16.014',
  branch: 'feature/retail-pos',
  commit: 'POS-SETTINGS-OFFLINE-SYNC-01489',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS Settings Offline Sync',
  updatedAt: '2026-07-16T22:05:00+07:00',
  whatsNew: [
    'Save all Retail POS store-setting form data locally before Firebase sync',
    'Queue tenant-scoped settings and sync automatically when connectivity returns',
    'Use the requested successful store-settings confirmation message'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
