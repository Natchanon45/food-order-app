export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.30',
  build: '2026.07.01.012',
  branch: 'feature/retail-pos',
  commit: 'HOTFIX-O1-T001.7',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Take Away Kitchen Served Lock',
  updatedAt: '2026-07-01T14:25:00+07:00',
  whatsNew: [
    'Add served action for Take Away orders in Kitchen',
    'Lock Take Away items after served status',
    'Disable item edit and cancel after Take Away is served',
    'Bump Kitchen cache after served lock update'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
