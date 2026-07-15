export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.66',
  build: '2026.07.15.009',
  branch: 'feature/retail-pos',
  commit: 'COLORFUL-MENU-ICONS-01466',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Colorful Menu Icons',
  updatedAt: '2026-07-15T18:25:00+07:00',
  whatsNew: [
    'Add color-coded Bootstrap menu icons across Retail POS navigation groups and menu links',
    'Add color accents for primary Order and Delivery heading icons while keeping the green, black, and white theme',
    'Keep printable receipt and tax invoice headers text-only and guard against adjacent duplicate icons',
    'Keep tenant product data, stock, VAT, payments, offline sync, and duplicate protection unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
