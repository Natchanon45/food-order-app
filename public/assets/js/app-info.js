export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.86',
  build: '2026.07.16.011',
  branch: 'feature/retail-pos',
  commit: 'LOGIN-VALIDATION-LAYOUT-01486',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Login Validation Layout Polish',
  updatedAt: '2026-07-16T20:35:00+07:00',
  whatsNew: [
    'Keep login validation feedback below the full input group',
    'Prevent login field icons and password toggle from moving when validation appears',
    'Cache-bust login validation assets for the deployed login screen'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
