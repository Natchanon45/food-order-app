export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.0',
  build: '2026.07.31.082',
  branch: 'feature/retail-pos',
  commit: 'FIREBASE-SALES-REPORT-PARITY-01499',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Firebase Sales Report Parity',
  updatedAt: '2026-07-31T08:05:00+07:00',
  whatsNew: [
    'Match the Laravel Sales Report header, layout, and default monthly period',
    'Combine restaurant orders and Retail POS sales from tenant-scoped Firestore collections',
    'Prevent duplicate receipts when a sale is represented in both report sources'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
