export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.95',
  build: '2026.07.23.001',
  branch: 'feature/retail-pos',
  commit: 'SUPER-ADMIN-PLATFORM-GUARD-01495',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Super Admin Platform Guard Recovery',
  updatedAt: '2026-07-23T06:10:00+07:00',
  whatsNew: [
    'Redirect Super Admin directly to the platform after login',
    'Restore page visibility when profile or permission loading fails',
    'Show retry and re-login recovery actions instead of a blank page'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
