export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.11',
  build: '2026.07.31.093',
  branch: 'feature/retail-pos',
  commit: 'TAX-ISSUE-TITLE-ICON-SPACING-01511',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Issue Title Icon Spacing',
  updatedAt: '2026-07-31T23:22:00+07:00',
  whatsNew: [
    'Separate the tax-invoice issue title icon from its text',
    'Align the receipt icon and heading with a consistent ten-pixel gap',
    'Keep tax-invoice lookup, history, sync, and printing behavior unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
