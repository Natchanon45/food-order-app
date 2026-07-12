export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.43',
  build: '2026.07.12.002',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-RECOVERY-DEEP-LINK-01443',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Recovery Deep Link',
  updatedAt: '2026-07-12T00:00:00+07:00',
  whatsNew: [
    'Add tax invoice history q deep links for support recovery',
    'Include Tax History URL in คัดลอก Sync recovery text',
    'Keep recovery links client-side and display-only with no data writes',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
