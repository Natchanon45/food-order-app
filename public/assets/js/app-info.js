export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.47',
  build: '2026.07.12.006',
  branch: 'feature/retail-pos',
  commit: 'TAX-COPY-LINK-CLIPBOARD-FALLBACK-01447',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Copy Link Clipboard Fallback',
  updatedAt: '2026-07-12T00:00:00+07:00',
  whatsNew: [
    'Harden tax invoice copy link when Clipboard API is blocked',
    'Fallback to the legacy textarea copy path for current view links and sync support packages',
    'Keep copy actions client-side and display-only with no data writes',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
