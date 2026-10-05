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
  build: '2026.10.05.126',
  branch: 'feature/react-firebase-port',
  commit: 'POS-PURCHASES-CONTROL-CENTER',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS Purchase & Receiving Control Center',
  updatedAt: '2026-10-05T09:05:47+0700',
  whatsNew: [
    'Redesign Purchases as a visual receiving control center with inbound KPIs, activity chart, rankings, and richer history cards',
    'Improve purchase-entry readability, mobile line cards, and semantic actions without changing receiving or stock-update logic',
    'Preserve realtime watchers, barcode scanning, CSV export, view_cost permissions, payable fields, and tenant boundaries'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
