export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.18',
  build: '2026.06.30.084',
  branch: 'feature/retail-pos',
  commit: 'P9-B005.3',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B005.3 POS Receipt Settings Restore & Loyalty Calculation Fix',
  updatedAt: '2026-06-30T22:10:00+07:00',
  whatsNew: [
    'Restore receipt paper size setting: 58mm, 80mm, A4',
    'Restore ask-before-print and auto-print receipt modes',
    'Prioritize saved local receipt settings for POS receipt shop name',
    'Calculate loyalty point preview on receipt immediately after sale save'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
