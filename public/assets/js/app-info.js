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
  build: '2026.10.07.156',
  branch: 'feature/react-firebase-port',
  commit: 'POS-FINAL-LEGACY-VISUAL-REFRESH',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Backup and Users visual refresh',
  updatedAt: '2026-10-07T08:08:00+0700',
  whatsNew: [
    'Modernize the POS Backup workspace with a responsive emerald/teal recovery dashboard',
    'Modernize the POS Users and permissions workspace with role, permission, and staff visual hierarchy',
    'Preserve all existing legacy Backup/User actions and Firebase behavior while refreshing presentation'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
