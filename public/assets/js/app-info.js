export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.45',
  build: '2026.07.01.028',
  branch: 'feature/retail-pos',
  commit: 'TABLE-MOVE-028',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Table Order Previous Rounds Fix',
  updatedAt: '2026-07-01T22:45:00+07:00',
  whatsNew: [
    'Add tableToken renderer for customer previous rounds',
    'Keep old table QR showing previous orders after table move',
    'Add admin active status icons for menu and table lists'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
