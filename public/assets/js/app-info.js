export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.71',
  build: '2026.07.15.014',
  branch: 'feature/retail-pos',
  commit: 'CATALOG-IMPORT-CONFIRMATION-01471',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Catalog Import Confirmation Summary',
  updatedAt: '2026-07-15T21:02:00+07:00',
  whatsNew: [
    'Add a final Retail Master Catalog import confirmation summary before writing products',
    'Show importable, skipped-existing, and waiting-verification counts in the confirmation dialog',
    'Cache-bust the catalog import CSS and JS for the new confirmation summary',
    'Keep tenant data, stock, VAT, payments, offline sync, duplicate protection, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
