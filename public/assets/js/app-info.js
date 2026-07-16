export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.83',
  build: '2026.07.16.008',
  branch: 'feature/retail-pos',
  commit: 'TAX-INVOICE-RECEIPT-PRINT-01483',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Invoice Page Count And Receipt Reprint',
  updatedAt: '2026-07-16T14:30:00+07:00',
  whatsNew: [
    'Fit up to 20 full tax invoice item rows per A4 page',
    'Show full tax invoice page numbers as page/total',
    'Remove external icon CSS from the full tax invoice print page',
    'Align sale-history receipt item rows with the checkout receipt format'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
