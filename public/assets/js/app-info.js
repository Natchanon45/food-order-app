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
  version: '0.16.26',
  build: '2026.09.16.011',
  branch: 'feature/retail-pos',
  commit: 'CASHIER-DELIVERY-FEE-BREAKDOWN',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Cashier Delivery Fee Breakdown',
  updatedAt: '2026-09-16T04:27:00+07:00',
  whatsNew: [
    'Show Delivery zone, food subtotal, and delivery fee separately on Cashier bills',
    'Reuse the same effective delivery amount calculation as Kitchen and receipt views',
    'Preserve vertical-only menu image positioning across public ordering pages'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
