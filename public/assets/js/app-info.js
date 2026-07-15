export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.74',
  build: '2026.07.15.017',
  branch: 'feature/retail-pos',
  commit: 'CATALOG-PREVIEW-FILTER-COUNTS-01474',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Catalog Preview Filter Counts',
  updatedAt: '2026-07-15T22:31:00+07:00',
  whatsNew: [
    'Add live status counts to the Retail Master Catalog preview dropdown',
    'Show counts for all, importable, ready, existing, and review-pending catalog rows',
    'Refresh preview counts when category shortcuts or the skip-existing toggle change',
    'Keep tenant data, stock, VAT, payments, offline sync, duplicate protection, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
