export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.12.3',
  build: '2026.06.30.051',
  branch: 'feature/retail-pos',
  commit: 'd4d9701',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B026 Browser Dialog Elimination',
  updatedAt: '2026-06-30T01:05:00+07:00',
  whatsNew: [
    'Disable native browser alert confirm prompt in sweet dialog runtime',
    'Use Sweet Dialog for SaaS setup migration confirm',
    'Refresh SaaS setup and tenant sweet dialog cache'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
