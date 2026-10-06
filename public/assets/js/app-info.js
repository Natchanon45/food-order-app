// TENANT_MANAGEMENT_WORKSPACE_20260804_001
// WAITING_QUEUE_TABLE_STATE_NUMBER_REPAIR_20260803_006
// PUBLIC_CONTACT_CENTER_20260803_005
// ADMIN_MODAL_HEADER_ICON_DEDUPLICATION_20260803_004
// ADMIN_MODAL_TEMPLATE_LOCAL_PRINT_FONT_20260803_003
// ADMIN_RESPONSIVE_PRINT_REFINEMENT_20260803_002
// ADMIN_WORKSPACE_VISUAL_REFRESH_20260803
// SUBSCRIPTION_PRICING_CONFIGURATION_20260920_001
export const APP_INFO = {
  name: 'PENGUIN',
  product: 'PENGUIN',
  version: '0.16.32',
  build: '2026.10.06.143',
  branch: 'feature/react-firebase-port',
  commit: 'POS-STOCK-COUNT-STICKY-SHELL-MOBILE-CARDS',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Stock Count sticky shell and mobile cards',
  updatedAt: '2026-10-06T12:10:00+0700',
  whatsNew: [
    'Pin the Stock Count search/filter workspace and column labels together below the POS action bar on desktop',
    'Align Stock Count desktop headers and row values to the same grid tracks',
    'Rebuild Mobile Stock Count rows as organized two-column metric cards'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
