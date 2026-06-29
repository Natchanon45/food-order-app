export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.11.9',
  build: '2026.06.29.047',
  branch: 'feature/retail-pos',
  commit: '018238d',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B022 Delivery Sweet Dialog',
  updatedAt: '2026-06-29T23:05:00+07:00',
  whatsNew: [
    'Fix real PromptPay QR download icon',
    'Use sweetConfirm for delivery edit locked order',
    'Use sweetConfirm for cart item and address delete'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
