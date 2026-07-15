export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.72',
  build: '2026.07.15.015',
  branch: 'feature/retail-pos',
  commit: 'CATALOG-IMPORT-REVIEW-REASONS-01472',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Catalog Import Review Reasons',
  updatedAt: '2026-07-15T21:18:00+07:00',
  whatsNew: [
    'Add short review reasons below each Retail Master Catalog preview status badge',
    'Explain ready, skipped-existing, and waiting-verification catalog rows before import',
    'Cache-bust the catalog import CSS and JS for the new status reason display',
    'Keep tenant data, stock, VAT, payments, offline sync, duplicate protection, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
