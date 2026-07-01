export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.26',
  build: '2026.07.01.007',
  branch: 'feature/retail-pos',
  commit: 'O1-T001.2',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'O1-T001.2 Tenant Take Away Route Fix',
  updatedAt: '2026-07-01T11:05:00+07:00',
  whatsNew: [
    'Route tenant Take Away URLs to the Take Away page',
    'Prevent /s/{tenant}/takeaway from falling through to delivery',
    'Keep tenant delivery and table order routes unchanged',
    'Update hosting rewrites for Take Away customer links'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
