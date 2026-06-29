export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.12.2',
  build: '2026.06.30.050',
  branch: 'feature/retail-pos',
  commit: 'c0f5b25',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B025 Sweet Dialog Cache Complete',
  updatedAt: '2026-06-30T00:45:00+07:00',
  whatsNew: [
    'Refresh Sweet Dialog cache for Cashier and Table QR',
    'Refresh Sweet Dialog cache for Kitchen and Table Order',
    'Use Sweet Dialog for Tenant delete and Subscription suspend'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
