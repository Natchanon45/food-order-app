export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.36',
  build: '2026.07.01.018',
  branch: 'feature/retail-pos',
  commit: 'P9-B010.1',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B010 POS Performance',
  updatedAt: '2026-07-01T17:45:00+07:00',
  whatsNew: [
    'Add virtual batch rendering for Retail POS product catalog',
    'Debounce POS product search to reduce re-render cost',
    'Cache product and sales search data in catalog controller',
    'Lazy load product images only for visible POS items'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
