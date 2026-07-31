export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.2',
  build: '2026.08.01.105',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-UI-POLISH-01602',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue UI Polish',
  updatedAt: '2026-08-01T06:55:00+07:00',
  whatsNew: [
    'Rename the table menu action to เปิดโต๊ะ and unify its icon',
    'Use a clear customer-waiting icon for the queue menu',
    'Align the add action and contain long queue numbers inside their badge'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
