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
  build: '2026.10.05.127',
  branch: 'feature/react-firebase-port',
  commit: 'POS-PAYABLES-CONTROL-CENTER',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS Accounts Payable Control Center',
  updatedAt: '2026-10-05T09:24:13+0700',
  whatsNew: [
    'Migrate Accounts Payable to canonical React with realtime purchase/supplier normalization and the approved visual control-center design',
    'Add due-date risk graphics, permission-aware payable KPIs, supplier ranking, responsive payable cards, and a polished payment dialog',
    'Preserve supplier-credit due dates, payment history, pay/view_amount permissions, purchase transaction behavior, and tenant boundaries'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
