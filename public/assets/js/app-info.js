export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.39',
  build: '2026.07.01.021',
  branch: 'feature/retail-pos',
  commit: 'O1-UI-021',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Kitchen Start Action Icon Animation',
  updatedAt: '2026-07-01T20:40:00+07:00',
  whatsNew: [
    'Change Kitchen start action icon to bi-hourglass-split',
    'Add lightweight hourglass flip animation for start action',
    'Keep Kitchen status workflow unchanged',
    'Bump Kitchen JS and CSS cache versions'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
