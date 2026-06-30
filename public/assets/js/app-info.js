export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.15',
  build: '2026.06.30.081',
  branch: 'feature/retail-pos',
  commit: 'P9-B005',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B005 Repository Layer',
  updatedAt: '2026-06-30T20:45:00+07:00',
  whatsNew: [
    'Add POS repository layer for local and Firestore access',
    'Route offline sale sync queue through repository helpers',
    'Route POS sync status through repository helpers',
    'Bump POS repository cache versions'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
