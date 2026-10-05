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
  build: '2026.10.05.130',
  branch: 'feature/react-firebase-port',
  commit: 'PUBLIC-LANDING-BRANDING-PRICING-POLISH',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Public landing, branding, and pricing polish',
  updatedAt: '2026-10-05T10:35:00+0700',
  whatsNew: [
    'Refresh the unauthenticated Home with richer colors while hiding the annual promotional price block for now',
    'Space the Register header action and show a clear red strike-through on the original annual price',
    'Apply Super Admin App Icon branding on Privacy, Terms, and tenant Delivery headers instead of PG fallback'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
