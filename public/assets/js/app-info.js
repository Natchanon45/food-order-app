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
  build: '2026.10.07.171',
  branch: 'feature/react-firebase-port',
  commit: 'WALKIN-CLOSE-DIALOG-ICON',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Walk-in close dialog icon correction',
  updatedAt: '2026-10-07T15:39:16+0700',
  whatsNew: [
    'Use a door-close icon for the Walk-in close-table confirmation action',
    'Keep the cancel action on the standard x icon so the two dialog actions are visually distinct',
    'Preserve the existing Walk-in close-table lifecycle and warning copy'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
