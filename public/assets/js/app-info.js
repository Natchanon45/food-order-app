export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.20',
  build: '2026.08.01.102',
  branch: 'feature/retail-pos',
  commit: 'COMPACT-CASHIER-TOOLS-01520',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Compact Cashier Tools',
  updatedAt: '2026-08-01T05:00:00+07:00',
  whatsNew: [
    'Keep all three Take Away tools on the title row',
    'Right-align compact icon actions on mobile',
    'Reduce vertical space without shrinking the touch targets excessively'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
