export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.27',
  build: '2026.07.01.008',
  branch: 'feature/retail-pos',
  commit: 'HOTFIX-O1-T001.3',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'HOTFIX Take Away Recovery',
  updatedAt: '2026-07-01T11:25:00+07:00',
  whatsNew: [
    'Restore delivery and table order routing',
    'Make Take Away submit without counter transaction',
    'Add QR display and cashier order button',
    'Bump cashier and takeaway cache versions'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
