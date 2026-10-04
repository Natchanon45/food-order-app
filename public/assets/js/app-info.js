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
  build: '2026.10.04.113',
  branch: 'feature/react-firebase-port',
  commit: 'POS-RETURNS-LOWER-WORKFLOW-POLISH',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS Returns lower workflow polish',
  updatedAt: '2026-10-04T23:07:37+0700',
  whatsNew: [
    'Polish the Returns lower workflow with richer loyalty, search, editor, summary, and history surfaces',
    'Add semantic icons to bill selection, new bill, VOID, confirm return, history receipt, and receipt print actions',
    'Preserve transaction-safe stock, loyalty, refund status, VOID, barcode scan, permissions, and tenant boundaries'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
