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
  build: '2026.10.07.160',
  branch: 'feature/react-firebase-port',
  commit: 'SUPER-ADMIN-WALLET-SLIP-ACCESS',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Super Admin wallet slip viewer repair',
  updatedAt: '2026-10-07T11:23:00+0700',
  whatsNew: [
    'Allow active Super Admin accounts to read tenant Lalamove wallet top-up slips for central review',
    'Restore View Slip for pending and Slip2Go auto-approved wallet top-ups',
    'Show a visible error toast if a wallet slip cannot be opened'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
