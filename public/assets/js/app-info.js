export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.97',
  build: '2026.07.31.079',
  branch: 'feature/retail-pos',
  commit: 'FIREBASE-UI-PARITY-01497',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Firebase UI Presentation Parity',
  updatedAt: '2026-07-31T06:50:00+07:00',
  whatsNew: [
    'Apply the green Order, Delivery, Kitchen, Cashier, and staff dashboard theme',
    'Modernize sales reporting, queue badges, action colors, icons, and dialogs',
    'Preserve Firebase tenant scope, stable IDs, duplicate protection, and offline sync'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
