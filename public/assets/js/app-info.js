export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.49',
  build: '2026.07.02.003',
  branch: 'feature/retail-pos',
  commit: 'POS-COUNTER-003',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B003 Counter',
  updatedAt: '2026-07-02T00:00:00+07:00',
  whatsNew: [
    'Add central POS counter service for Firestore transaction usage',
    'Expose counter scope, counter ref, next counter snapshot, and counter commit helpers',
    'Support reusable reserveRunningNumber for SALE, RECEIPT, TAX, REFUND, VOID, SHIFT, PURCHASE, STOCK, and TRANSFER',
    'Prepare Offline Queue Worker and Repository Layer to share one counter workflow'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
