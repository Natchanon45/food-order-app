export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.8',
  build: '2026.06.30.074',
  branch: 'feature/retail-pos',
  commit: 'P9-B002',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B002 Running Number',
  updatedAt: '2026-06-30T14:10:00+07:00',
  whatsNew: [
    'Add counter-based POS running number POS-YYYYMMDD-00001',
    'Assign official saleNumber inside online Firestore transaction',
    'Assign official saleNumber during offline sale sync',
    'Keep stable saleId and duplicate/stock movement protection'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
