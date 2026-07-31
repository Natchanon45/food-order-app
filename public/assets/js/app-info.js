export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.4',
  build: '2026.07.31.086',
  branch: 'feature/retail-pos',
  commit: 'RETAIL-CATEGORY-MANAGER-USABILITY-01504',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail Product Category Manager Usability',
  updatedAt: '2026-07-31T10:36:00+07:00',
  whatsNew: [
    'Replace the long category card grid with a compact searchable and paginated management list',
    'Add status filters, sorting, category counts, and a focused add/edit dialog',
    'Keep stable category IDs, tenant-scoped product metadata, and saved POS category order aligned after a rename'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
