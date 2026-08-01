export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.5',
  build: '2026.08.01.006',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-TICKET-QR-CALL-RECOVERY',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue Ticket QR And Call Recovery',
  updatedAt: '2026-08-01T22:30:00+07:00',
  whatsNew: [
    'Open a privacy-safe QR ticket modal from the customer-link action and print an 80 mm queue ticket',
    'Enable queue display audio with a chime only and never speak the audio-enabled test sentence',
    'Use the authenticated staff tenant and compatible Firestore identity checks for queue call and sync writes'
  ],
  marker: 'WAITING_QUEUE_TICKET_QR_CALL_RECOVERY_20260801_006'
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
