export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.11',
  build: '2026.06.30.077',
  branch: 'feature/retail-pos',
  commit: 'P9-B003',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B003 Counter',
  updatedAt: '2026-06-30T19:25:00+07:00',
  whatsNew: [
    'Remove duplicate hamburger icon from POS menu button',
    'Standardize POS counter document metadata for online sale',
    'Standardize POS counter document metadata for offline sync',
    'Bump POS counter cache versions'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
