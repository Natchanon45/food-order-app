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
  build: '2026.10.07.165',
  branch: 'feature/react-firebase-port',
  commit: 'THAI-ORDER-ALERT-SPEECH',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Natural Thai order alert speech',
  updatedAt: '2026-10-07T12:48:08+0700',
  whatsNew: [
    'Replace spoken Delivery, Walk-in, Takeaway, and Table labels with natural Thai service wording',
    'Announce Table orders as สั่งที่โต๊ะ without speaking a table number',
    'Keep the existing Thai female voice, chime, amount calculation, and alert behavior unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
