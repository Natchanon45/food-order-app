export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.53',
  build: '2026.07.02.007',
  branch: 'feature/retail-pos',
  commit: 'POS-COMPOSITE-INDEX-006',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B006 Firestore Composite Index',
  updatedAt: '2026-07-02T00:00:00+07:00',
  whatsNew: [
    'Add POS Firestore composite indexes for sales reporting and filters',
    'Add POS indexes for stock movements by product, date, and reference',
    'Add POS indexes for sync queue, audit logs, shifts, and returns',
    'Prepare Audit Log, Shift, Refund, and Performance milestones'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
