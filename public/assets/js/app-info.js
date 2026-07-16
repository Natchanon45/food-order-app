export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.85',
  build: '2026.07.16.010',
  branch: 'feature/retail-pos',
  commit: 'TAX-BUYER-DBD-VALIDATION-LAYOUT-01485',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Buyer DBD And Validation Layout Polish',
  updatedAt: '2026-07-16T19:42:00+07:00',
  whatsNew: [
    'Improve tax invoice history open/print button contrast',
    'Add DBD lookup to the tax buyer edit dialog',
    'Keep product form validation feedback from stretching barcode input controls',
    'Keep product code and barcode inputs at a stable height during validation'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
