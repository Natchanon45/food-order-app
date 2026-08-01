export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.1',
  build: '2026.08.01.002',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-UI-CONSOLIDATION',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue UI Consolidation',
  updatedAt: '2026-08-01T11:30:00+07:00',
  whatsNew: [
    'Consolidate table waiting queue into one staff page and remove the floating dashboard shortcut',
    'Rebuild the staff filters and table-opening dialog with balanced, readable layouts',
    'Clarify the customer tracker and public queue display, including explicit chime plus Thai voice calling'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
