export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.41',
  build: '2026.07.01.023',
  branch: 'feature/retail-pos',
  commit: 'ADMIN-USERS-023',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Owner Staff List Fix',
  updatedAt: '2026-07-01T21:35:00+07:00',
  whatsNew: [
    'Fix Owner staff list on Admin Users page',
    'Load staff from tenant memberships when callable list is unavailable',
    'Keep staff management scoped to active tenant',
    'Bump Admin Users cache version'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
