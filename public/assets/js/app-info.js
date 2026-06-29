export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.11.7',
  build: '2026.06.29.045',
  branch: 'feature/retail-pos',
  commit: 'b3d99fa',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B020 Horizontal Scroll Patch',
  updatedAt: '2026-06-29T21:40:00+07:00',
  whatsNew: [
    'Improve horizontal wheel scroll',
    'Restore POS category scrollbar',
    'Refresh catalog cache'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
