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
  version: '0.16.25',
  build: '2026.09.16.010',
  branch: 'feature/retail-pos',
  commit: 'VERTICAL-MENU-IMAGE-POSITION',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Vertical Menu Image Position Parity',
  updatedAt: '2026-09-16T01:38:00+07:00',
  whatsNew: [
    'Apply admin menu image focal positions consistently to Delivery, Take Away, and table ordering',
    'Keep image focal position values clamped with a safe 50% center fallback',
    'Preserve responsive menu cards, favorites, and notification improvements'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
