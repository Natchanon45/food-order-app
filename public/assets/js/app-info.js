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
  build: '2026.10.06.150',
  branch: 'feature/react-firebase-port',
  commit: 'POS-PURCHASES-RESPONSIVE-REFINEMENT',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Purchases responsive refinement',
  updatedAt: '2026-10-06T22:30:00+0700',
  whatsNew: [
    'Rebalance the Purchases desktop item table and simplify the delete action',
    'Rebuild mobile purchase items as clean two-column cards with colored stock/cost totals',
    'Keep CSV export text visible on mobile and rebalance purchase report filters/cards'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
