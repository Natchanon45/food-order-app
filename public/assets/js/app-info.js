export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.19',
  build: '2026.08.01.101',
  branch: 'feature/retail-pos',
  commit: 'HEADER-NOTIFICATION-ALIGNMENT-01519',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Header Notification Alignment',
  updatedAt: '2026-08-01T04:55:00+07:00',
  whatsNew: [
    'Keep the notification bell directly beside the user profile',
    'Use the same compact header action group on desktop and mobile',
    'Preserve the existing Push Notification behavior and profile menu'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
