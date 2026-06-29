export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.11.8',
  build: '2026.06.29.046',
  branch: 'feature/retail-pos',
  commit: 'a4f93d3',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B021 Order Delivery UX',
  updatedAt: '2026-06-29T22:05:00+07:00',
  whatsNew: [
    'Order and Delivery show 10 items per desktop page',
    'Tighten menu card price and add button layout',
    'Add sweet dialog alert helper and QR download icon'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
