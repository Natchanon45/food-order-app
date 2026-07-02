export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.56',
  build: '2026.07.02.010',
  branch: 'feature/retail-pos',
  commit: 'POS-RETURN-009',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B009 Refund / Return / Void',
  updatedAt: '2026-07-02T00:00:00+07:00',
  whatsNew: [
    'Add central POS return service',
    'Support createReturn, createRefund, and createVoid with Firestore transaction',
    'Restore stock with duplicate protection based on sale returns metadata',
    'Write audit logs and document numbers for return workflows'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
