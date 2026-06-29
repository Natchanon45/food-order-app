export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.12.5',
  build: '2026.06.30.061',
  branch: 'feature/retail-pos',
  commit: 'b7695d3',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P8-B001 Retail POS Offline Sync Safe',
  updatedAt: '2026-06-30T03:45:00+07:00',
  whatsNew: [
    'Use stable sale IDs for POS online and offline sales',
    'Make offline POS sync tenant-safe to prevent cross-tenant sync',
    'Use deterministic stock movement IDs to prevent duplicate stock deduction',
    'Lock Delivery kitchen editing after rider handoff'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
