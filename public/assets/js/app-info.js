export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.2',
  build: '2026.08.01.003',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-CONFLICT-RECOVERY',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue Conflict Recovery',
  updatedAt: '2026-08-01T16:30:00+07:00',
  whatsNew: [
    'Automatically reconcile stale Waiting Queue outbox operations against the latest Firebase state',
    'Retry transaction contention with a larger bounded attempt budget and Thai operator messages',
    'Use one authoritative dashboard card and prevent stale local queue state from overriding terminal remote state'
  ],
  marker: 'WAITING_QUEUE_CONFLICT_RECOVERY_20260801_003'
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
