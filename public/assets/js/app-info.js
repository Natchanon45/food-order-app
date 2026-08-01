export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.6',
  build: '2026.08.02.001',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-RUNTIME-REPAIR',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue Runtime Repair',
  updatedAt: '2026-08-02T00:15:00+07:00',
  whatsNew: [
    'Replace Waiting Queue public and board mirrors with clean privacy-safe snapshots',
    'Authorize deterministic Waiting Queue draft orders and exact table occupation writes',
    'Render one compact QR Code in the printable customer ticket modal'
  ],
  marker: 'WAITING_QUEUE_RUNTIME_REPAIR_20260802_001'
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
