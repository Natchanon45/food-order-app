export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.43',
  build: '2026.07.01.025',
  branch: 'feature/retail-pos',
  commit: 'ADMIN-USERS-025',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Hide Owner From Staff List',
  updatedAt: '2026-07-01T22:10:00+07:00',
  whatsNew: [
    'Hide owner accounts from Admin Users staff list',
    'Keep Admin Users list limited to admin, cashier, and kitchen roles',
    'Prevent owner role from falling back to cashier display',
    'Confirm table QR keeps working after table move by stable tableToken'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
