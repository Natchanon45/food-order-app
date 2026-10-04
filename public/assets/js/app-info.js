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
  build: '2026.10.05.120',
  branch: 'feature/react-firebase-port',
  commit: 'POS-PRODUCT-EDITOR-POLISH',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS Product editor and pagination polish',
  updatedAt: '2026-10-05T01:18:00+0700',
  whatsNew: [
    'Default Products pagination to 10 rows with 10/25/50/100 page-size choices and balanced ellipsis spacing',
    'Redesign Product and Category dialogs with complete semantic icons and a custom drag/drop image upload surface',
    'Preserve product/category CRUD, stock operations, barcode scanning, drag sorting, permissions, and tenant boundaries'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
