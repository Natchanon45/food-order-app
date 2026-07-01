export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.54',
  build: '2026.07.02.008',
  branch: 'feature/retail-pos',
  commit: 'POS-AUDIT-LOG-007',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B007 Audit Log',
  updatedAt: '2026-07-02T00:00:00+07:00',
  whatsNew: [
    'Add central POS audit log service',
    'Add standard audit actions for sale, sync, shift, refund, return, void, and stock adjustment',
    'Support transaction-safe audit log writes',
    'Prepare Shift Opening/Closing and Refund/Return/Void milestones'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
