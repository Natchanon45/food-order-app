export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.28',
  build: '2026.07.01.009',
  branch: 'feature/retail-pos',
  commit: 'HOTFIX-O1-T001.4',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'HOTFIX Delivery Order Take Away Recovery',
  updatedAt: '2026-07-01T11:45:00+07:00',
  whatsNew: [
    'Restore getStoreSettings in data service for Delivery menu loading',
    'Force Delivery, Table Order, and Take Away to load data-service cache v20260701-009',
    'Keep Take Away submit on public order create without counter transaction',
    'Keep QR display and cashier Take Away order button'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
