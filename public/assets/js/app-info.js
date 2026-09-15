// TENANT_MANAGEMENT_WORKSPACE_20260804_001
// WAITING_QUEUE_TABLE_STATE_NUMBER_REPAIR_20260803_006
// PUBLIC_CONTACT_CENTER_20260803_005
// ADMIN_MODAL_HEADER_ICON_DEDUPLICATION_20260803_004
// ADMIN_MODAL_TEMPLATE_LOCAL_PRINT_FONT_20260803_003
// ADMIN_RESPONSIVE_PRINT_REFINEMENT_20260803_002
// ADMIN_WORKSPACE_VISUAL_REFRESH_20260803
export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.16',
  build: '2026.09.15.001',
  branch: 'feature/retail-pos',
  commit: 'ADMIN-DELIVERY-UX-FAVORITES',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Admin And Delivery UX Favorites',
  updatedAt: '2026-09-15T22:55:00+07:00',
  whatsNew: [
    'Refresh responsive admin menu cards, modal layout, map selection, and pagination',
    'Add customer menu favorites with guest-device and signed-in account persistence',
    'Improve duplicate menu validation and order notification sound'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
