export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.17',
  build: '2026.06.30.083',
  branch: 'feature/retail-pos',
  commit: 'P9-B005.2',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B005.2 POS Receipt Data Hydration & Print Cleanup',
  updatedAt: '2026-06-30T21:45:00+07:00',
  whatsNew: [
    'Hydrate POS receipt with shop and receipt settings',
    'Show customer/member data on POS receipt',
    'Show loyalty point summary on POS receipt',
    'Hide toast and notification UI while printing receipts'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
