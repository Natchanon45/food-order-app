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
  build: '2026.10.05.138',
  branch: 'feature/react-firebase-port',
  commit: 'POS-SCANNER-I18N-RETURNS-SEARCH',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS scanner localization and Returns search layout',
  updatedAt: '2026-10-05T15:40:00+0700',
  whatsNew: [
    'Localize POS barcode scanner buttons, dialogs, statuses, and error Toasts in all five languages',
    'Keep the red scanner guide line inside the green scan frame',
    'Place Returns search mode, search field, and Search button in one desktop row with responsive mobile stacking'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
