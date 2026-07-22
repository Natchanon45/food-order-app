export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.96',
  build: '2026.07.23.002',
  branch: 'main',
  commit: 'RETAIL-POS-MAIN-INTEGRATION-01496',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS Main Integration',
  updatedAt: '2026-07-23T06:35:00+07:00',
  whatsNew: [
    'Integrate the completed Retail POS feature history into main',
    'Keep tenant-scoped online and offline workflows with duplicate protection',
    'Carry forward the Super Admin platform login recovery'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
