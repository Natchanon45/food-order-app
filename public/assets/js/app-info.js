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
  build: '2026.10.03.091',
  branch: 'feature/react-firebase-port',
  commit: 'POS-VISUAL-PARITY',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS sales tax returns visual parity',
  updatedAt: '2026-10-03T16:34:39+0700',
  whatsNew: [
    'Match Sales quick-filter and report-heading icon badges to the current task2 Retail POS reference',
    'Match Tax Invoice History header, icon chips, document cards, and desktop width to the task2 reference',
    'Restore Returns search modes, section icons, and floating developer/version control consistently'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
