export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.17',
  build: '2026.07.08.030',
  branch: 'feature/retail-pos',
  commit: 'DELIVERY-FEE-UI-01417',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Custom Delivery Fee UI Polish',
  updatedAt: '2026-07-08T00:00:00+07:00',
  whatsNew: [
    'Move the add delivery fee option action to the card header',
    'Style the add option action as the primary green button',
    'Polish delivery fee option rows with clearer spacing and row numbers',
    'Preserve custom delivery fee dropdown behavior and order totals'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
