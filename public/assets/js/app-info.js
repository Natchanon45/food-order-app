export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.57',
  build: '2026.07.02.011',
  branch: 'feature/retail-pos',
  commit: 'POS-PERFORMANCE-010',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B010 Performance (Cache / Virtual List / Search)',
  updatedAt: '2026-07-02T00:00:00+07:00',
  whatsNew: [
    'Add POS performance layer for product grid',
    'Debounce product search input to reduce repeated renders',
    'Limit visible product cards for large product lists',
    'Add local POS performance snapshot for cache diagnostics'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
