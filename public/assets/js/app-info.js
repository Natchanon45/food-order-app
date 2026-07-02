export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.62',
  build: '2026.07.02.016',
  branch: 'feature/retail-pos',
  commit: 'POS-HARDENING-002',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'POS Hardening 002',
  updatedAt: '2026-07-02T00:00:00+07:00',
  whatsNew: [
    'Add POS hardening diagnostics for long-running cashier sessions',
    'Track queue summary, localStorage usage, uptime, event counters, and multi-tab leader state',
    'Expose window.retailPosHardening.diagnostics() for manual inspection',
    'Bump hardening script version to prevent stale browser cache'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
