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
  build: '2026.10.07.167',
  branch: 'feature/react-firebase-port',
  commit: 'POS-BACKUP-TYPED-SCOPED-RESTORE',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS React cutover with safe typed restore',
  updatedAt: '2026-10-07T14:00:32+0700',
  whatsNew: [
    'Complete the React cutover for /pos/backup and /pos/users',
    'Upgrade POS backups to version 2 with exact Firestore typed values and POS numbering/integrity data',
    'Scope restore away from shared Admin, Delivery, Lalamove, Quick Order settings, counters, and held bills'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
