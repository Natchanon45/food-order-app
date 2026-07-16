export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.94',
  build: '2026.07.17.002',
  branch: 'feature/retail-pos',
  commit: 'POS-CATALOG-SINGLE-RENDERER-01494',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Catalog Single Renderer',
  updatedAt: '2026-07-17T03:20:00+07:00',
  whatsNew: [
    'Make the catalog renderer the sole owner of the POS product grid',
    'Keep large catalogs paged at 96 visible products per render',
    'Prevent the legacy product renderer and performance limiter from replacing image cards'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
