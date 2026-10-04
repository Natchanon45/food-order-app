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
  build: '2026.10.04.102',
  branch: 'feature/react-firebase-port',
  commit: 'POS-MENU-MODERN-CARD-V21',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS Modern Card v2.1 sizing and color',
  updatedAt: '2026-10-04T15:28:47+0700',
  whatsNew: [
    'Make the approved POS drawer wider, taller, and more spacious on desktop and mobile',
    'Increase profile, group, submenu, icon, and logout sizing for easier scanning and touch targets',
    'Strengthen category and active-row colors while keeping the same Modern Card structure'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
