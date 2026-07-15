export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.77',
  build: '2026.07.16.002',
  branch: 'feature/retail-pos',
  commit: 'POS-RECEIPT-PRIVACY-01477',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Receipt Privacy Masking',
  updatedAt: '2026-07-16T01:05:00+07:00',
  whatsNew: [
    'Standardize printed POS receipt customer-name and phone masking',
    'Apply the same privacy format to sale history receipts, receipt windows, and customer sale receipts',
    'Render saved POS VAT mode as an explicit receipt row instead of a dash amount',
    'Keep tenant data, stock, payments, offline sync, duplicate protection, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
