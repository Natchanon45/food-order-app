export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.65',
  build: '2026.07.15.008',
  branch: 'feature/retail-pos',
  commit: 'PRODUCT-IMAGE-STORAGE-FALLBACK-01465',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Product Image Storage Fallback',
  updatedAt: '2026-07-15T15:45:00+07:00',
  whatsNew: [
    'Handle Firebase Storage quota or upload failures in the product image editor without blocking product saves',
    'Save the selected product image locally as an IndexedDB fallback when cloud upload is unavailable',
    'Keep existing product image URLs intact for other devices and show a readable Thai warning instead of raw Firebase errors',
    'Keep tenant product data, stock, VAT, payments, offline sync, and duplicate protection unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
