export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.18',
  build: '2026.07.08.031',
  branch: 'feature/retail-pos',
  commit: 'TAX-INVOICE-LABELS-01418',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Invoice Label Consistency',
  updatedAt: '2026-07-08T00:00:00+07:00',
  whatsNew: [
    'Use ใบกำกับภาษี consistently across POS receipt and tax invoice history',
    'Shorten tax invoice buyer and void dialog titles',
    'Keep tax invoice print title, history title, and receipt action wording aligned',
    'Preserve existing tax invoice duplicate, sync, and void behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
