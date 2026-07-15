export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.70',
  build: '2026.07.15.013',
  branch: 'feature/retail-pos',
  commit: 'CATALOG-IMPORT-FILTERS-01470',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Catalog Import Filters',
  updatedAt: '2026-07-15T20:42:00+07:00',
  whatsNew: [
    'Add Retail Master Catalog preview search by product name, barcode, SKU, brand, category, and keywords',
    'Add preview filters for importable now, verified ready, already in store, and waiting verification products',
    'Cache-bust the catalog import CSS and JS for the new preview filter controls',
    'Keep tenant data, stock, VAT, payments, offline sync, duplicate protection, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
