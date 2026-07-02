export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.58',
  build: '2026.07.02.012',
  branch: 'feature/retail-pos',
  commit: 'POS-MANUAL-SYNC-HOTFIX-012',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B010 Manual Sync Hotfix',
  updatedAt: '2026-07-02T00:00:00+07:00',
  whatsNew: [
    'Fix POS manual Sync button to use latest offline queue worker',
    'Bump POS sync status script version to prevent stale browser cache',
    'Show worker state from retail-offline-queue-worker events',
    'Keep P9-B010 performance layer unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
