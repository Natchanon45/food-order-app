export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.55',
  build: '2026.07.02.009',
  branch: 'feature/retail-pos',
  commit: 'POS-SHIFT-008',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B008 Shift Opening / Closing',
  updatedAt: '2026-07-02T00:00:00+07:00',
  whatsNew: [
    'Add central POS shift opening and closing service',
    'Support openShift and closeShift with Firestore transaction and stable shift number',
    'Write audit logs for shift opened and shift closed actions',
    'Prepare Refund/Return/Void milestone to use active shift data'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
