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
  build: '2026.10.04.101',
  branch: 'feature/react-firebase-port',
  commit: 'POS-MENU-MODERN-CARD-V2',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS Modern Card menu redesign',
  updatedAt: '2026-10-04T15:06:24+0700',
  whatsNew: [
    'Apply the approved Modern Card v2 POS drawer across React and remaining legacy POS pages',
    'Keep expandable card groups with compact profile, central-home, active submenu, and logout sections',
    'Keep the drawer responsive with independent menu scrolling and bottom-anchored logout'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
