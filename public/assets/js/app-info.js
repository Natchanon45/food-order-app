export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.0',
  build: '2026.08.01.001',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-MVP-01600',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue MVP',
  updatedAt: '2026-08-01T10:39:37+07:00',
  whatsNew: [
    'Add a table waiting queue with stable W-numbers separate from food and order queues',
    'Support local-first staff intake, fair table matching, call/response states, audit history, and transaction-safe seating',
    'Add privacy-safe customer tracking and a public queue display with in-store sound'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
