export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.31',
  build: '2026.07.01.013',
  branch: 'feature/retail-pos',
  commit: 'HOTFIX-O1-T001.8',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Mobile Kitchen Icon & QR Print Font',
  updatedAt: '2026-07-01T14:55:00+07:00',
  whatsNew: [
    'Show Kitchen served action as icon-only on mobile',
    'Keep Kitchen served action text on desktop',
    'Use TH Sarabun PSK Local for Admin QR print output',
    'Bump Kitchen and Admin QR cache versions'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
