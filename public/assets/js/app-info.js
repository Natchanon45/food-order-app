export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.21',
  build: '2026.07.09.002',
  branch: 'feature/retail-pos',
  commit: 'TAX-VOID-SYNC-DIAGNOSTICS-01421',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Void Sync Diagnostics',
  updatedAt: '2026-07-09T00:00:00+07:00',
  whatsNew: [
    'Record sync diagnostics when tax invoice void transactions fall back locally',
    'Show void fallback sync errors in tax invoice history through existing Sync Error badges',
    'Keep local void retry state visible without changing source sales or stock',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
