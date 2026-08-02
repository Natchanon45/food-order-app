// ADMIN_MODAL_TEMPLATE_LOCAL_PRINT_FONT_20260803_003
// ADMIN_RESPONSIVE_PRINT_REFINEMENT_20260803_002
// ADMIN_WORKSPACE_VISUAL_REFRESH_20260803
export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.11',
  build: '2026.08.03.003',
  branch: 'feature/retail-pos',
  commit: 'ADMIN-MODAL-TEMPLATE-LOCAL-PRINT-FONT',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Admin Modal Template And Local Print Font',
  updatedAt: '2026-08-03T04:38:29+07:00',
  whatsNew: [
    'Use the Admin Users modal template for Menu and Table forms',
    'Print Admin QR documents with local TH Sarabun PSK only',
    'Simplify the Admin Hero and align QR Table action height'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
