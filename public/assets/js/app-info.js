export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.12.0',
  build: '2026.06.29.048',
  branch: 'feature/retail-pos',
  commit: '91f9071',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B023 Sweet Dialog Complete',
  updatedAt: '2026-06-29T23:40:00+07:00',
  whatsNew: [
    'Center sweet dialog on mobile',
    'Load sweet dialog in Admin',
    'Use sweetConfirm for Admin menu and table delete'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
