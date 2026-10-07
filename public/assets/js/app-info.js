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
  build: '2026.10.07.166',
  branch: 'feature/react-firebase-port',
  commit: 'POS-BACKUP-USERS-REACT-CUTOVER',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS Backup and Users React cutover',
  updatedAt: '2026-10-07T13:25:26+0700',
  whatsNew: [
    'Cut over /pos/backup and /pos/users from legacy HTML/JavaScript to canonical React routes',
    'Preserve custom roles, granular POS permissions, password updates, and five-language Backup/Users UI',
    'Remove the legacy Backup and Users page-logic JavaScript while keeping stable URLs and responsive visuals'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
