export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.10',
  build: '2026.06.30.076',
  branch: 'feature/retail-pos',
  commit: 'P9-B002.2',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B002.2 POS Auth Warning Cleanup',
  updatedAt: '2026-06-30T17:05:00+07:00',
  whatsNew: [
    'Prefer tenant role settings before roles collection lookup',
    'Stop noisy tenant roles collection warning during POS load',
    'Bump POS auth/navigation cache versions',
    'Add POS favicon link to avoid favicon.ico 404'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
