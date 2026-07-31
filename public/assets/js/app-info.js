export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.13',
  build: '2026.07.31.095',
  branch: 'feature/retail-pos',
  commit: 'SHARED-DIALOG-ACTION-LAYOUT-01513',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Shared Dialog Action Layout',
  updatedAt: '2026-07-31T23:45:00+07:00',
  whatsNew: [
    'Keep confirmation actions side by side with cancel on the left and confirm on the right',
    'Add a consistent 8 px gap between every shared-dialog icon and its label',
    'Hide the cancel action correctly for one-action alert dialogs'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
