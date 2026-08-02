// ADMIN_MODAL_HEADER_ICON_DEDUPLICATION_20260803_004
// ADMIN_MODAL_TEMPLATE_LOCAL_PRINT_FONT_20260803_003
// ADMIN_RESPONSIVE_PRINT_REFINEMENT_20260803_002
// ADMIN_WORKSPACE_VISUAL_REFRESH_20260803
export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.12',
  build: '2026.08.03.004',
  branch: 'feature/retail-pos',
  commit: 'ADMIN-MODAL-HEADER-ICON-DEDUPLICATION',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Admin Modal Header Icon Deduplication',
  updatedAt: '2026-08-03T05:29:13+07:00',
  whatsNew: [
    'Show one icon badge in Admin Menu and Table modal headers',
    'Exclude shared modal titles from generic heading icon decoration',
    'Preserve the existing Admin entity form workflow'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
