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
  build: '2026.10.04.096',
  branch: 'feature/react-firebase-port',
  commit: 'POS-PRODUCTS-REACT-CUTOVER',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS products React cutover',
  updatedAt: '2026-10-04T11:51:51+0700',
  whatsNew: [
    'Serve canonical /pos/products from React with the full legacy product/category/stock/sort surface',
    'Preserve realtime data, barcode scanning, permissions, dialogs, Toast behavior, and catalog sorting',
    'Protect legacy Firestore product document IDs during edit, stock adjustment, delete, and sort writes'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
