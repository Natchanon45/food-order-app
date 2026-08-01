export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.6',
  build: '2026.08.02.004',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-TABLE-SESSION-BRIDGE',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue Table Session Bridge',
  updatedAt: '2026-08-02T00:15:00+07:00',
  whatsNew: [
    'Open Waiting Queue tables with the canonical table order token and session fields',
    'Navigate to the tenant storefront order URL with table code and token',
    'Repair already seated Waiting Queue tables that are missing an order session'
  ],
  marker: 'WAITING_QUEUE_TABLE_SESSION_BRIDGE_20260802_004'
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
