export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.16',
  build: '2026.08.01.098',
  branch: 'feature/retail-pos',
  commit: 'AUTHORITATIVE-STORE-SETTINGS-01516',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Authoritative Store Settings',
  updatedAt: '2026-08-01T04:00:00+07:00',
  whatsNew: [
    'Use Firestore as the authoritative VAT and PromptPay configuration',
    'Prevent stale browser settings from overriding explicit remote values',
    'Refresh the tenant-local settings cache from the resolved remote configuration'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
