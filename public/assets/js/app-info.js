export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.5',
  build: '2026.07.31.087',
  branch: 'feature/retail-pos',
  commit: 'CATEGORY-PAGINATION-NUMBERS-01505',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Category Pagination Number Cleanup',
  updatedAt: '2026-07-31T11:05:00+07:00',
  whatsNew: [
    'Show category pagination page buttons as numbers only',
    'Keep the previous and next arrow controls unchanged',
    'Preserve all category data, sorting, filters, and tenant-scoped persistence behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
