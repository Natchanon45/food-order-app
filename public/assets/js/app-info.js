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
  build: '2026.10.04.116',
  branch: 'feature/react-firebase-port',
  commit: 'POS-SHIFT-OPERATIONS-DASHBOARD',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS Shift Operations Dashboard',
  updatedAt: '2026-10-04T23:38:58+0700',
  whatsNew: [
    'Redesign Staff Shifts as a colorful Shift Operations Dashboard with active/inactive visual states',
    'Add shift sales trend, cash/payment mix ring, richer cash reconciliation cards, and mobile history cards',
    'Preserve offline-first shift sync, granular permissions, opening/closing cash logic, history, and tenant boundaries'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
