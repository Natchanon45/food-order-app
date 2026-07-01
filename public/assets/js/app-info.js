export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.37',
  build: '2026.07.01.019',
  branch: 'feature/retail-pos',
  commit: 'P9-B010.2',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Payment Focus UX',
  updatedAt: '2026-07-01T19:55:00+07:00',
  whatsNew: [
    'Auto select received amount when opening POS payment modal',
    'Auto select received amount when clicking back into the field',
    'Reduce cashier typing steps after selecting customer or loyalty member',
    'No change to POS sale, stock, or Firestore workflow'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
