export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.14',
  build: '2026.06.30.080',
  branch: 'feature/retail-pos',
  commit: 'P9-B004.1',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B004.1 POS Menu Spacing',
  updatedAt: '2026-06-30T20:30:00+07:00',
  whatsNew: [
    'Increase POS drawer padding on desktop and mobile',
    'Increase spacing between POS menu groups',
    'Improve touch target height for POS accordion links',
    'Bump POS navigation CSS cache version'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
