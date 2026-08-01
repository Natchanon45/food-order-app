export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.3',
  build: '2026.08.01.004',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-USABILITY-PERMISSION-REPAIR',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue Usability And Permission Repair',
  updatedAt: '2026-08-01T19:30:00+07:00',
  whatsNew: [
    'Allow canonical tenant memberships and staff roles to operate Waiting Queue writes',
    'Increase staff and customer readability while keeping the responsive layouts balanced',
    'Polish dialog actions, validation stability, public-display icons, and natural Thai queue speech'
  ],
  marker: 'WAITING_QUEUE_USABILITY_PERMISSION_20260801_004'
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
