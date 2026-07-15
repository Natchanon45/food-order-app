export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.69',
  build: '2026.07.15.012',
  branch: 'feature/retail-pos',
  commit: 'CATALOG-IMPORT-READINESS-01469',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Catalog Import Readiness UI',
  updatedAt: '2026-07-15T20:18:00+07:00',
  whatsNew: [
    'Add a Retail Master Catalog readiness summary for selected, ready, importable, skipped-existing, and review-pending products',
    'Explain when ready catalog products are skipped because the tenant store already has the same SKU or barcode',
    'Cache-bust the catalog import CSS and JS for the new readiness panel',
    'Keep tenant data, stock, VAT, payments, offline sync, duplicate protection, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
