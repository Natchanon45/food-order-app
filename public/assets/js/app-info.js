// PUBLIC_CONTACT_CENTER_20260803_005
// ADMIN_MODAL_HEADER_ICON_DEDUPLICATION_20260803_004
// ADMIN_MODAL_TEMPLATE_LOCAL_PRINT_FONT_20260803_003
// ADMIN_RESPONSIVE_PRINT_REFINEMENT_20260803_002
// ADMIN_WORKSPACE_VISUAL_REFRESH_20260803
export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.16.13',
  build: '2026.08.03.005',
  branch: 'feature/retail-pos',
  commit: 'PUBLIC-CONTACT-CENTER',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Public Contact Center',
  updatedAt: '2026-08-03T08:17:46+07:00',
  whatsNew: [
    'Add Super Admin managed contact channels to the public landing',
    'Support phone, LINE, Facebook Messenger, and email contact actions',
    'Restrict global contact writes to validated super_admin access'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
