export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.84',
  build: '2026.07.16.009',
  branch: 'feature/retail-pos',
  commit: 'PRINT-ICON-MOBILE-VALIDATION-01484',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Print Icon And Mobile Validation Polish',
  updatedAt: '2026-07-16T15:55:00+07:00',
  whatsNew: [
    'Use explicit print and receipt icons on tax invoice history actions',
    'Prewarm receipt and tax invoice print layouts before opening print preview',
    'Keep validation feedback under barcode scanner input rows',
    'Make the staff table scroll horizontally on mobile screens'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
