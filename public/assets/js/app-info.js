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
  build: '2026.10.05.131',
  branch: 'feature/react-firebase-port',
  commit: 'DELIVERY-BRANDING-STORE-NAME-ROUTING',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Delivery branding and Order/Delivery store-name routing',
  updatedAt: '2026-10-05T11:09:00+0700',
  whatsNew: [
    'Apply the shared Super Admin App Icon on Delivery Success instead of the PG fallback',
    'Prefer the tenant Order/Delivery name over generic store settings on the Delivery storefront',
    'Keep the Delivery Success receipt store name aligned with the customer-facing Delivery storefront'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
