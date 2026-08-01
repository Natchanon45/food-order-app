export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.6',
  build: '2026.08.02.003',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-TICKET-PRINT-POLISH',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue Ticket Print Polish',
  updatedAt: '2026-08-02T00:15:00+07:00',
  whatsNew: [
    'Balance the customer ticket preview and include suitable groups ahead',
    'Print 80 x 160 mm queue tickets with local TH Sarabun PSK fonts',
    'Wait for the local font and QR image before opening the print dialog'
  ],
  marker: 'WAITING_QUEUE_TICKET_PRINT_POLISH_20260802_003'
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
