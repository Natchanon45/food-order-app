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
  build: '2026.10.07.172',
  branch: 'feature/react-firebase-port',
  commit: 'FULL-REACT-SYSTEM-CUTOVER',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Full React system cutover',
  updatedAt: '2026-10-07T17:25:00+0700',
  whatsNew: [
    'Move the remaining public storefront, legal, verification, and POS utility entrypoints onto the canonical React shell',
    'Replace legacy Delivery and Takeaway page runtimes with native React/Firebase flows while preserving Maps, Lalamove, promotions, PromptPay, slips, favorites, and customer addresses',
    'Guard every physical frontend index entry and Hosting rewrite so future builds cannot fall back to page-specific legacy HTML'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
