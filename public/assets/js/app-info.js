export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.98',
  build: '2026.07.31.080',
  branch: 'feature/retail-pos',
  commit: 'FIREBASE-WORKFLOW-PARITY-01498',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Firebase UI and Workflow Parity',
  updatedAt: '2026-07-31T07:45:00+07:00',
  whatsNew: [
    'Match the Laravel UI and browser workflow while keeping Firestore as the data store',
    'Group table rounds and sort stable queues consistently in Kitchen and Cashier',
    'Restore cashier Take Away tools, admin add flows, staff logout, and POS presentation parity'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
