export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.16',
  build: '2026.06.30.082',
  branch: 'feature/retail-pos',
  commit: 'P9-B005.1',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B005.1 POS Receipt Print Fix',
  updatedAt: '2026-06-30T21:05:00+07:00',
  whatsNew: [
    'Load POS receipt modal on the POS sale page',
    'Auto-open receipt after sale save',
    'Trigger same-window receipt print after sale save',
    'Fix receipt print CSS root for fallback printing'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
