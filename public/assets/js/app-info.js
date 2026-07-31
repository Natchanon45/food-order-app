export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.21',
  build: '2026.08.01.103',
  branch: 'main',
  commit: 'RETAIL-POS-MAIN-INTEGRATION-01521',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS Main Integration',
  updatedAt: '2026-08-01T05:15:00+07:00',
  whatsNew: [
    'Integrate the completed Retail POS feature history into main',
    'Preserve tenant-safe online and offline workflows',
    'Carry forward the latest Kitchen and Cashier interface updates'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
