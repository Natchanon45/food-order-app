export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.61',
  build: '2026.07.15.004',
  branch: 'feature/retail-pos',
  commit: 'VALIDATION-TEXT-ONLY-01461',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Validation Text Only',
  updatedAt: '2026-07-15T03:25:00+07:00',
  whatsNew: [
    'Show validation messages as red inline text directly under invalid inputs, selects, and textareas',
    'Keep the original field shape, border, background, shadow, and label color unchanged during validation',
    'Disable native browser validation bubbles for shared forms while keeping printable receipt/tax documents excluded',
    'Keep VAT, stock, payment, offline sync, tenant data, duplicate protection, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
