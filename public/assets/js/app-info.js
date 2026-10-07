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
  build: '2026.10.07.155',
  branch: 'feature/react-firebase-port',
  commit: 'POS-CUSTOMERS-DIALOG-OK-I18N-FIX',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Customers dialog OK translation repair',
  updatedAt: '2026-10-07T07:47:00+0700',
  whatsNew: [
    'Fix the Customer cannot-delete alert so the OK button uses the localized shared.actions.ok label',
    'Apply the same localized OK key correction to Customer delete-error and Supplier delete alerts',
    'Add regression guards preventing the obsolete shared.action.ok key from returning raw text'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
