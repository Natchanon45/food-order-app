export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.21',
  build: '2026.06.30.087',
  branch: 'feature/retail-pos',
  commit: 'P9-B007',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B007 Audit Log',
  updatedAt: '2026-06-30T23:25:00+07:00',
  whatsNew: [
    'Add POS sale audit log on successful Firestore transaction',
    'Record audit log with tenant, device, user, sale number, amount, and sync status',
    'Use deterministic audit log id to avoid duplicate audit records',
    'Bump POS page cache for audit logging change'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
