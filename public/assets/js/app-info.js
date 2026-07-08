export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.12',
  build: '2026.07.08.025',
  branch: 'feature/retail-pos',
  commit: 'POS-APP-INFO-01412',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Developer Panel Tax Sync Build Alignment',
  updatedAt: '2026-07-08T00:00:00+07:00',
  whatsNew: [
    'Align Developer Panel version, build, milestone, and commit with the latest full tax invoice sync hardening build',
    'Refresh app-info cache chain through the POS toast/status loader',
    'Keep full tax invoice offline void sync behavior unchanged',
    'Bump POS toast status imports to prevent stale browser cache'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
