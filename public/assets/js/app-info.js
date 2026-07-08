export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.16',
  build: '2026.07.08.029',
  branch: 'feature/retail-pos',
  commit: 'DELIVERY-FEE-OPTIONS-01416',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Custom Delivery Fee Options',
  updatedAt: '2026-07-08T00:00:00+07:00',
  whatsNew: [
    'Allow admins to name delivery fee options and set each fee',
    'Show custom delivery fee options in the customer Delivery dropdown',
    'Keep legacy three-zone delivery fee settings as a fallback',
    'Preserve existing Delivery order totals and saved delivery zone labels'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
