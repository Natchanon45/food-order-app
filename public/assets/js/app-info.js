export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.22',
  build: '2026.07.01.003',
  branch: 'feature/retail-pos',
  commit: 'P9-B008',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B008 Shift Opening / Closing',
  updatedAt: '2026-07-01T09:40:00+07:00',
  whatsNew: [
    'Stabilize POS shift opening and closing flow',
    'Save shifts with tenant, device, user, opening cash, closing cash, and cash difference',
    'Support Firestore with local fallback for shift records',
    'Bump shift page cache after shift workflow update'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
