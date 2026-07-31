export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.0',
  build: '2026.08.01.103',
  branch: 'feature/retail-pos',
  commit: 'WAITING-TABLE-QUEUE-MVP-01600',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Table Queue MVP',
  updatedAt: '2026-08-01T06:00:00+07:00',
  whatsNew: [
    'Staff-managed waiting queue ordered fairly by arrival time and party size',
    'Atomic queue-to-table seating with stable table session token',
    'Privacy-safe real-time customer queue tracking page'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
