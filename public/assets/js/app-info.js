export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.14',
  build: '2026.07.08.027',
  branch: 'feature/retail-pos',
  commit: 'ADMIN-QR-COLLAPSE-01414',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Admin QR Copy and Collapse Bugfix',
  updatedAt: '2026-07-08T00:00:00+07:00',
  whatsNew: [
    'Show one copy-link label on Delivery and Takeaway QR buttons',
    'Start admin cards collapsed on every page load',
    'Ignore the previous admin collapsed-card localStorage state',
    'Keep QR generation, print, and download behavior unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
