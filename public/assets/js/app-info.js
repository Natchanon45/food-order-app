export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.19',
  build: '2026.06.30.085',
  branch: 'feature/retail-pos',
  commit: 'P9-B005.4',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B005.4 POS Receipt Loyalty Fix',
  updatedAt: '2026-06-30T22:42:00+07:00',
  whatsNew: [
    'Fix POS receipt loyalty timing',
    'Use selected customer for receipt points',
    'Show full point rows on receipt',
    'Update receipt modal cache version'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
