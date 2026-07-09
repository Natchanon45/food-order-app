export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.28',
  build: '2026.07.10.003',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-RECOVERY-COPY-01428',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Recovery Copy',
  updatedAt: '2026-07-10T00:00:00+07:00',
  whatsNew: [
    'Add คัดลอก Sync support handoff action to tax invoice history cards with Sync Error',
    'Copy invoice, sale, buyer, sync action, phase, target, error, and attempt metadata',
    'Keep the recovery copy action client-side and display-only',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
