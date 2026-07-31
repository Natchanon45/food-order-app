export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.15',
  build: '2026.08.01.097',
  branch: 'feature/retail-pos',
  commit: 'PRODUCT-PAGINATION-SORT-SAVE-01515',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Product Pagination and Sort Save',
  updatedAt: '2026-08-01T03:45:00+07:00',
  whatsNew: [
    'Show icon-only previous and next controls in product pagination',
    'Persist only reordered products instead of rewriting the entire catalog',
    'Restore the sort-save button after success, failure, or timeout'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
