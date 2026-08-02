// ADMIN_WORKSPACE_VISUAL_REFRESH_20260803
export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.9',
  build: '2026.08.03.001',
  branch: 'main',
  commit: 'ADMIN-WORKSPACE-VISUAL-REFRESH',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Admin Workspace Visual Refresh',
  updatedAt: '2026-08-03T01:45:06+07:00',
  whatsNew: [
    'Align the Firebase owner password dialog with the Laravel interface',
    'Add password visibility controls and consistent validation feedback',
    'Use one current application version on the login footer'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
