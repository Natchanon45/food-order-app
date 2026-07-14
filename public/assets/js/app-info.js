export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.60',
  build: '2026.07.15.003',
  branch: 'feature/retail-pos',
  commit: 'VALIDATION-FEEDBACK-01460',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Validation Feedback Under Fields',
  updatedAt: '2026-07-15T02:55:00+07:00',
  whatsNew: [
    'Show validation messages directly under invalid inputs, selects, and textareas in red across shared web forms',
    'Disable native browser validation bubbles for shared forms so users see consistent inline feedback',
    'Keep valid filled fields green, invalid fields red, optional empty fields neutral, and printable receipt/tax documents excluded',
    'Keep VAT, stock, payment, offline sync, tenant data, duplicate protection, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
