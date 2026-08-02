export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.8',
  build: '2026.08.02.104',
  branch: 'main',
  commit: 'FIREBASE-AUTH-UI-PARITY-01608',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Firebase Auth UI Parity',
  updatedAt: '2026-08-02T09:15:00+07:00',
  whatsNew: [
    'Align the Firebase owner password dialog with the Laravel interface',
    'Add password visibility controls and consistent validation feedback',
    'Use one current application version on the login footer'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
