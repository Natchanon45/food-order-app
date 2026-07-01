export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.48',
  build: '2026.07.02.002',
  branch: 'feature/retail-pos',
  commit: 'POS-RUNNING-NUMBER-002',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B002 Running Number',
  updatedAt: '2026-07-02T00:00:00+07:00',
  whatsNew: [
    'Add central POS running number foundation for SALE, RECEIPT, TAX, REFUND, VOID, SHIFT, PURCHASE, STOCK, and TRANSFER',
    'Keep existing POS sale number API backward compatible',
    'Store running number metadata per tenant, document type, and reset period',
    'Prepare POS milestones for Counter, Offline Queue Worker, Audit Log, Shift, Refund, and Performance phases'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
