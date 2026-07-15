export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.79',
  build: '2026.07.16.004',
  branch: 'feature/retail-pos',
  commit: 'DELIVERY-COD-EDIT-UNLOCK-01479',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Delivery COD Edit Unlock',
  updatedAt: '2026-07-16T02:20:00+07:00',
  whatsNew: [
    'Keep Delivery cash-on-delivery carts editable until the customer confirms the order',
    'Use the payment amount lock only for PromptPay or transfer orders that need a stable QR/slip amount',
    'Clear stale Delivery payment locks when a restored draft is set back to cash on delivery',
    'Bump the Delivery payment-lock cache chain for hosting deploy'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
