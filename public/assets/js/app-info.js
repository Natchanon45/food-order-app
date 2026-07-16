export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.82',
  build: '2026.07.16.007',
  branch: 'feature/retail-pos',
  commit: 'TAX-INVOICE-A4-PAGINATION-01482',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Invoice A4 Pagination Polish',
  updatedAt: '2026-07-16T12:35:00+07:00',
  whatsNew: [
    'Repeat full tax invoice header and buyer data on every A4 page',
    'Keep invoice item rows capped at 10 per printed page',
    'Show totals and signature lines only on the final page',
    'Append seller and buyer branch text to the tax ID line'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
