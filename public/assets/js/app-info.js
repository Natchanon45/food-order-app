export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.1',
  build: '2026.08.01.104',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-VALIDATION-ALIGN-01601',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue Validation Alignment',
  updatedAt: '2026-08-01T06:45:00+07:00',
  whatsNew: [
    'Keep the add-queue action aligned with the desktop input row',
    'Prevent validation feedback from shifting the action button',
    'Retain the full-width stacked mobile action layout'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
