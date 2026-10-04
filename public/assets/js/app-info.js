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
  build: '2026.10.04.105',
  branch: 'feature/react-firebase-port',
  commit: 'POS-TENANT-MENU-THEMES',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS tenant-selectable menu themes',
  updatedAt: '2026-10-04T16:56:47+0700',
  whatsNew: [
    'Add five tenant-selectable POS menu themes with Modern Card preserved as the default',
    'Add Summary Dashboard and Dark Mode Hi-Tech plus Minimal Clean and Section Sidebar alternatives',
    'Persist the theme per tenant while preserving permissions, routes, and React/legacy POS behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
