export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.58',
  build: '2026.07.15.001',
  branch: 'feature/retail-pos',
  commit: 'TAX-ICONS-POS-IMAGE-FALLBACK-01458',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Icons and POS Image Fallback',
  updatedAt: '2026-07-15T01:45:00+07:00',
  whatsNew: [
    'Load Bootstrap Icons on the POS tax invoice history page so headings and action buttons show icons again',
    'Restore POS product card fallback display when product image URLs fail or invalid image fields are encountered',
    'Refresh POS cache versions for the product image renderer and app metadata chain',
    'Keep VAT, stock, payment, offline sync, and tax invoice data behavior unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
