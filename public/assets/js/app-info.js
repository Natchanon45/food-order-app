export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.75',
  build: '2026.07.15.018',
  branch: 'feature/retail-pos',
  commit: 'CATALOG-IMPORT-RESULT-ACTIONS-01475',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Catalog Import Result Actions',
  updatedAt: '2026-07-15T22:58:00+07:00',
  whatsNew: [
    'Add a structured success panel after Retail Master Catalog imports',
    'Show imported count, imported SKU/name examples, and a product-review link',
    'Let owners copy the SKU list from the imported batch for follow-up checks',
    'Keep tenant data, stock, VAT, payments, offline sync, duplicate protection, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
