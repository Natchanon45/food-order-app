export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.32',
  build: '2026.07.01.014',
  branch: 'feature/retail-pos',
  commit: 'HOTFIX-O1-T001.9',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Kitchen Serve Item & Cashier Table Icons',
  updatedAt: '2026-07-01T15:20:00+07:00',
  whatsNew: [
    'Use bi-send-check for Kitchen serve item action',
    'Make only serve item action icon-only on mobile',
    'Keep whole-order served button text visible on mobile and desktop',
    'Use bi-easel2 for Cashier table checkout and table move actions'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
