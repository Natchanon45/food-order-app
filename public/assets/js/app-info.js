export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.80',
  build: '2026.07.16.005',
  branch: 'feature/retail-pos',
  commit: 'POS-LOCAL-FIRST-RECEIPT-01480',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Local First Receipt Data',
  updatedAt: '2026-07-16T03:15:00+07:00',
  whatsNew: [
    'Save Retail POS bills to local storage first so checkout no longer waits for Firebase',
    'Queue the local sale for the existing Firebase sync worker with the same stable saleId',
    'Patch customer/member and loyalty rows locally before the receipt window renders',
    'Keep local stock deduction idempotent so the same saleId cannot deduct stock twice'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
