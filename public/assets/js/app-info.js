export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.20',
  build: '2026.06.30.086',
  branch: 'feature/retail-pos',
  commit: 'P9-B006',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B006 Firestore Composite Index',
  updatedAt: '2026-06-30T23:05:00+07:00',
  whatsNew: [
    'Add Firestore composite indexes for retail POS sales queries',
    'Add indexes for sale items and stock movements report queries',
    'Add sync queue index for offline retry worker',
    'Add loyalty and shift query indexes'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
