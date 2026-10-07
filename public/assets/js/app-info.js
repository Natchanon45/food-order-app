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
  build: '2026.10.07.154',
  branch: 'feature/react-firebase-port',
  commit: 'POS-CUSTOMERS-DIALOG-SHELL-DELETE-FIX',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Customers dialog shell and delete confirmation repair',
  updatedAt: '2026-10-07T07:34:00+0700',
  whatsNew: [
    'Restore correct inset spacing for Customer purchase/points-history header icons and close buttons',
    'Fix Customer delete confirmation so it renders text instead of [object Object]',
    'Correct the same SweetDialog argument misuse in Supplier delete alerts and confirmations'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
