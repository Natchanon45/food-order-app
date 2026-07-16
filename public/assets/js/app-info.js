export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.90',
  build: '2026.07.16.015',
  branch: 'feature/retail-pos',
  commit: 'POS-SETTINGS-NONBLOCKING-SYNC-01490',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS Settings Nonblocking Sync',
  updatedAt: '2026-07-16T22:20:00+07:00',
  whatsNew: [
    'Keep the Retail POS settings page responsive during Firebase connectivity issues',
    'Move settings sync fully to a delayed background queue with an eight-second timeout',
    'Preserve tenant-scoped local-first settings and automatic online recovery sync'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
