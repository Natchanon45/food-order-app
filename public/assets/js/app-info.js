export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.4',
  build: '2026.08.01.005',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-OWNER-ACCESS-DIALOG-SPACING',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue Owner Access And Dialog Spacing',
  updatedAt: '2026-08-01T21:45:00+07:00',
  whatsNew: [
    'Resolve Waiting Queue tenant from the authenticated staff profile instead of stale generic browser keys',
    'Authorize owner and staff writes through safe users, membership, owner, and claim checks',
    'Add modal action icons and internal spacing without changing the table-opening transaction'
  ],
  marker: 'WAITING_QUEUE_OWNER_ACCESS_DIALOG_20260801_005'
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
