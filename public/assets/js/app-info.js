export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.6',
  build: '2026.08.02.005',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-TICKET-MODAL-READABILITY',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue Ticket Modal Readability',
  updatedAt: '2026-08-02T00:15:00+07:00',
  whatsNew: [
    'Increase customer ticket modal text readability and visual hierarchy',
    'Replace the long visible tracking URL with a concise ready state',
    'Keep the copy-link action and printed QR ticket data unchanged'
  ],
  marker: 'WAITING_QUEUE_TICKET_MODAL_READABILITY_20260802_005'
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
