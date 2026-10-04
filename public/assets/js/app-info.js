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
  build: '2026.10.05.123',
  branch: 'feature/react-firebase-port',
  commit: 'PLATFORM-BRANDING-ASSET-GEOMETRY',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Platform branding asset geometry and guidance',
  updatedAt: '2026-10-05T02:36:44+0700',
  whatsNew: [
    'Use a wide Login logo surface, contained square header App Icon geometry, and shared branding on the legacy homepage',
    'Show recommended Logo, Favicon, and App/PWA Icon dimensions directly in Super Admin Branding',
    'Preserve existing branding storage paths, permissions, tenant behavior, and PG fallbacks'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
