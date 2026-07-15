export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.78',
  build: '2026.07.16.003',
  branch: 'feature/retail-pos',
  commit: 'POS-RECEIPT-RELIABILITY-01478',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Receipt Reliability Repair',
  updatedAt: '2026-07-16T01:45:00+07:00',
  whatsNew: [
    'Return POS checkout UI immediately after a sale is saved while opening the receipt popup in the background',
    'Let receipt windows and sale-history reprints recover customer and loyalty rows from local customer/ledger cache',
    'Reconcile old local sync rows against Firestore by saleId and sale number before retrying',
    'Add DBD lookup support to late full-tax invoice issuing from an existing POS bill'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
