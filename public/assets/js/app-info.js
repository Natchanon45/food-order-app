export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.40',
  build: '2026.07.11.010',
  branch: 'feature/retail-pos',
  commit: 'TAX-SYNC-SOURCE-FILTER-SEMANTICS-01440',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Tax Sync Source Filter Semantics',
  updatedAt: '2026-07-11T00:00:00+07:00',
  whatsNew: [
    'Clarify tax invoice source filters as remote-only, local-only, and both-source',
    'Keep source filter counts aligned with the displayed source groups',
    'Preserve combined source, sync, and search filtering as UI-only',
    'Preserve full tax invoice duplicate, sync, void, VAT, payment, and stock behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
