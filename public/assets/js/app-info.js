export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.15',
  build: '2026.07.08.028',
  branch: 'feature/retail-pos',
  commit: 'ADMIN-REPORT-CARD-01415',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Admin Report Card Action Fix',
  updatedAt: '2026-07-08T00:00:00+07:00',
  whatsNew: [
    'Keep the sales report card as a direct report action without collapse controls',
    'Keep all other admin cards collapsed on every page load',
    'Preserve the Delivery and Takeaway QR copy label fix',
    'Keep QR generation, print, download, and POS logic unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
