export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.59',
  build: '2026.07.15.002',
  branch: 'feature/retail-pos',
  commit: 'BOOTSTRAP-FORM-VALIDATION-01459',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Bootstrap Form Validation UI',
  updatedAt: '2026-07-15T02:10:00+07:00',
  whatsNew: [
    'Add shared Bootstrap-style validation UI for inputs, selects, and textareas across Order/Delivery, Admin, Register, and Retail POS pages',
    'Show required or invalid fields in red after touch or submit, and show valid filled fields in green',
    'Keep optional empty fields neutral and exclude printable receipt/tax document surfaces from validation styling',
    'Keep VAT, stock, payment, offline sync, tenant data, duplicate protection, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
