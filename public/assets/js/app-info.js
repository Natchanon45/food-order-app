export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.23',
  build: '2026.07.01.004',
  branch: 'feature/retail-pos',
  commit: 'P9-B009',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B009 Refund / Return / Void',
  updatedAt: '2026-07-01T10:05:00+07:00',
  whatsNew: [
    'Update POS return and refund transaction flow',
    'Add full bill VOID action from the return screen',
    'Use stable stock movement ids for return records',
    'Add return and void audit logs with tenant and device metadata'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
