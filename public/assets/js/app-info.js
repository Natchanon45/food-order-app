export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.6',
  build: '2026.08.02.002',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-IMMEDIATE-TICKET-HANDOFF',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue Immediate Ticket Handoff',
  updatedAt: '2026-08-02T00:15:00+07:00',
  whatsNew: [
    'Open the printable customer QR ticket immediately after successful queue intake',
    'Keep copy-link and 80 mm print actions together in the canonical ticket dialog',
    'Preserve privacy-safe local QR generation and stable Waiting Queue identifiers'
  ],
  marker: 'WAITING_QUEUE_IMMEDIATE_TICKET_HANDOFF_20260802_002'
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
