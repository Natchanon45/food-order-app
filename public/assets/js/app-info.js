export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.29',
  build: '2026.07.01.010',
  branch: 'feature/retail-pos',
  commit: 'HOTFIX-O1-T001.5',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'HOTFIX Take Away Kitchen Submit & Mobile UX',
  updatedAt: '2026-07-01T12:45:00+07:00',
  whatsNew: [
    'Allow public tenant Take Away order create through Firestore rules',
    'Clone table QR sticky category and mobile scrollspy behavior to Take Away',
    'Force toast alerts to top layer above cart bars and overlays',
    'Bump Take Away and app CSS cache versions'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
