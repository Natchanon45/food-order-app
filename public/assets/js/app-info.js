export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.7',
  build: '2026.06.30.073',
  branch: 'feature/retail-pos',
  commit: '09879f1',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B001 POS Firestore Foundation',
  updatedAt: '2026-06-30T13:50:00+07:00',
  whatsNew: [
    'Add POS Firestore foundation helper and schema metadata',
    'Write POS saleItems and dailySummary inside the online sale transaction',
    'Add syncQueue foundation for POS sale sync status',
    'Document POS Firestore structure and regression tests'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
