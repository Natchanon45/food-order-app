export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.67',
  build: '2026.07.15.010',
  branch: 'feature/retail-pos',
  commit: 'COLORFUL-HOME-MENU-ICONS-01467',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Colorful Home Menu Icons',
  updatedAt: '2026-07-15T18:58:00+07:00',
  whatsNew: [
    'Add color-coded icon chips to the central Order/Delivery and Retail POS dashboard menu cards',
    'Add matching color accents to the central user menu icons for faster recognition',
    'Keep the overall green, black, and white theme while avoiding adjacent duplicate icons',
    'Keep tenant product data, stock, VAT, payments, offline sync, and duplicate protection unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
