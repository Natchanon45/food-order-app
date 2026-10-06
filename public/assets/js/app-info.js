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
  build: '2026.10.06.145',
  branch: 'feature/react-firebase-port',
  commit: 'TAKEAWAY-CANCEL-LALAMOVE-RESTORE',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Takeaway cancellation and Lalamove logic restore',
  updatedAt: '2026-10-06T13:25:00+0700',
  whatsNew: [
    'Restore the original Lalamove local-cancel lock and separate provider cancellation flow',
    'Fix Take Away whole-order cancellation in Cashier through the proven status-update path',
    'Fix Take Away whole-order cancellation in Kitchen with Laravel-parity zeroed totals'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
