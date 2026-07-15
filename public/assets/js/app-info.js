export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.73',
  build: '2026.07.15.016',
  branch: 'feature/retail-pos',
  commit: 'CATALOG-IMPORT-CATEGORY-SHORTCUTS-01473',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Catalog Import Category Shortcuts',
  updatedAt: '2026-07-15T22:12:00+07:00',
  whatsNew: [
    'Add category selection shortcuts to the Retail Master Catalog import page',
    'Let owners select all categories, ready categories only, or clear category selection quickly',
    'Refresh preview/importable counts when the skip-existing toggle changes',
    'Keep tenant data, stock, VAT, payments, offline sync, duplicate protection, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
