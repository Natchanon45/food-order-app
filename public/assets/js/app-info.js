// WAITING_QUEUE_TABLE_STATE_NUMBER_REPAIR_20260803_006
// PUBLIC_CONTACT_CENTER_20260803_005
// ADMIN_MODAL_HEADER_ICON_DEDUPLICATION_20260803_004
// ADMIN_MODAL_TEMPLATE_LOCAL_PRINT_FONT_20260803_003
// ADMIN_RESPONSIVE_PRINT_REFINEMENT_20260803_002
// ADMIN_WORKSPACE_VISUAL_REFRESH_20260803
export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.14',
  build: '2026.08.03.006',
  branch: 'feature/retail-pos',
  commit: 'WAITING-QUEUE-TABLE-STATE-NUMBER-REPAIR',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Waiting Queue Table State And Number Allocation Repair',
  updatedAt: '2026-08-03T09:51:16+07:00',
  whatsNew: [
    'Restore all available tables to Waiting Queue through canonical table state',
    'Allocate online waiting numbers one queue at a time',
    'Keep a small offline lease without page-open or premature-refill number gaps'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
