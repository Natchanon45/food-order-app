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
  build: '2026.10.04.099',
  branch: 'feature/react-firebase-port',
  commit: 'POS-STOCK-MOVEMENTS-VISUAL-PARITY',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS stock movements final visual parity',
  updatedAt: '2026-10-04T12:44:22+0700',
  whatsNew: [
    'Match the task2 Stock Movements report-heading bookmark icon exactly',
    'Retain the Stock Movements React cutover, permissions, realtime data, CSV export, and barcode filtering',
    'Retain task2 filter icons, scanner controls, mobile card behavior, global Toast/dialog rules, and bounded readiness'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
