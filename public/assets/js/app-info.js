export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.25',
  build: '2026.07.01.006',
  branch: 'feature/retail-pos',
  commit: 'O1-T001.1',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'O1-T001.1 Take Away Cashier Fix',
  updatedAt: '2026-07-01T10:55:00+07:00',
  whatsNew: [
    'Add Take Away link tools on cashier page',
    'Allow cashier to copy the Take Away customer link',
    'Fix cashier date display fallback',
    'Bump cashier page cache after Take Away fix'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
