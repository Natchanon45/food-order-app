export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.87',
  build: '2026.07.16.012',
  branch: 'feature/retail-pos',
  commit: 'ADMIN-HERO-TITLE-CLEANUP-01487',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Admin Hero Title Icon Cleanup',
  updatedAt: '2026-07-16T21:13:23+07:00',
  whatsNew: [
    'Remove the decorative icon directly beside the Admin hero heading',
    'Keep Admin section and action icons unchanged',
    'Cache-bust the Admin icon polish asset for the deployed admin screen'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
