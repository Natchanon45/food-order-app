export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.61',
  build: '2026.07.02.015',
  branch: 'feature/retail-pos',
  commit: 'POS-HARDENING-001',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Hardening 001',
  updatedAt: '2026-07-02T00:00:00+07:00',
  whatsNew: [
    'Add POS stability hardening layer for long-running cashier sessions',
    'Recover stale offline sync records after browser sleep or interrupted sync',
    'Clean old synced local sales while preserving pending, failed, and conflict queue records',
    'Add lightweight multi-tab leader heartbeat and maintenance snapshot'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
