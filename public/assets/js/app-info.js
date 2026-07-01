export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.38',
  build: '2026.07.01.020',
  branch: 'feature/retail-pos',
  commit: 'O1-T001.11',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Order Completion & Receipt Print Fix',
  updatedAt: '2026-07-01T20:10:00+07:00',
  whatsNew: [
    'Finalize served and paid orders to paid automatically',
    'Hide completed Take Away orders from Cashier and Kitchen',
    'Keep order completion rules consistent for served plus paid',
    'Restrict receipt print output to receipt content only'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
