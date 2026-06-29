export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.12.1',
  build: '2026.06.30.049',
  branch: 'feature/retail-pos',
  commit: 'a6740ec',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B024 Global Sweet Dialog',
  updatedAt: '2026-06-30T00:15:00+07:00',
  whatsNew: [
    'Cashier Table QR close table uses Sweet Dialog',
    'Cashier and Kitchen confirm actions use Sweet Dialog',
    'Table Order cart remove uses Sweet Dialog'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
