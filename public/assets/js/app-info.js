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
  build: '2026.10.07.158',
  branch: 'feature/react-firebase-port',
  commit: 'SUPER-ADMIN-REQUEST-NOTIFICATIONS',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Super Admin request notification badges',
  updatedAt: '2026-10-07T09:13:04+0700',
  whatsNew: [
    'Notify Super Admin about pending wallet top-up and revenue-share submissions',
    'Keep same-day Slip2Go matched auto-approved submissions visible in notification badges',
    'Show aggregate and per-tenant notification breakdowns with direct review actions'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
