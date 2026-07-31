export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.17',
  build: '2026.08.01.099',
  branch: 'feature/retail-pos',
  commit: 'TENANT-PUSH-TOKEN-RULES-01517',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Secure Push Notification Enrollment',
  updatedAt: '2026-08-01T04:20:00+07:00',
  whatsNew: [
    'Allow tenant members to register only their own Push token',
    'Validate token ownership, tenant, role, document ID, and fields',
    'Show actionable Push Notification setup errors'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
