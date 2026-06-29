export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.12.4',
  build: '2026.06.30.052',
  branch: 'feature/retail-pos',
  commit: '4901a02',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B027 Table Move',
  updatedAt: '2026-06-30T01:25:00+07:00',
  whatsNew: [
    'Add cashier table move action for unpaid table orders',
    'Move active table session only to available tables',
    'Close old table and keep unpaid orders on the new table'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
