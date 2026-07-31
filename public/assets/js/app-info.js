export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.14',
  build: '2026.08.01.096',
  branch: 'feature/retail-pos',
  commit: 'MOBILE-PAYMENT-DIALOG-VALIDATION-01514',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Mobile Payment Dialog and Validation',
  updatedAt: '2026-08-01T03:30:00+07:00',
  whatsNew: [
    'Right-align the received cash field on mobile payment screens',
    'Replace the sales export native message with the shared two-action dialog',
    'Render invalid form controls with a red border and red focus ring system-wide'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
