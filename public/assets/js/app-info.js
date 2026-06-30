export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.9',
  build: '2026.06.30.075',
  branch: 'feature/retail-pos',
  commit: 'P9-B002.1',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B002.1 Firestore Rules for Running Number',
  updatedAt: '2026-06-30T16:40:00+07:00',
  whatsNew: [
    'Allow POS counter reads/writes for Running Number transactions',
    'Add Firestore rules for saleItems, dailySummary and syncQueue',
    'Prepare auditLogs rules for future POS audit milestone',
    'Keep tenant payload validation for POS foundation writes'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
