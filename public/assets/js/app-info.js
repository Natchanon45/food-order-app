export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.3',
  build: '2026.08.01.106',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-FULL-NUMBER-01603',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue Full Number',
  updatedAt: '2026-08-01T07:25:00+07:00',
  whatsNew: [
    'Expand the Waiting Queue badge to show the complete queue number',
    'Keep the full queue number visible on both desktop and mobile',
    'Preserve stored queue values and all existing queue workflows'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
