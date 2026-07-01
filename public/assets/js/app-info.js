export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.35',
  build: '2026.07.01.017',
  branch: 'feature/retail-pos',
  commit: 'UI-017',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Delivery Category Scroll & Admin Sort Fix',
  updatedAt: '2026-07-01T17:20:00+07:00',
  whatsNew: [
    'Fix Delivery PC category horizontal scroll after category click',
    'Add saveStoreSettings support for Admin category order',
    'Fix Admin sort save after category rename',
    'Bump Delivery and Admin sort cache versions'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
