export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.91',
  build: '2026.07.16.016',
  branch: 'feature/retail-pos',
  commit: 'TAX-BUYER-TAX-ID-FIRST-01491',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Buyer Tax ID First',
  updatedAt: '2026-07-16T23:30:00+07:00',
  whatsNew: [
    'Move the buyer tax ID field above the buyer or company name field',
    'Keep the DBD lookup button attached to the tax ID input',
    'Preserve existing tax buyer recovery validation and save behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
