export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.88',
  build: '2026.07.16.013',
  branch: 'feature/retail-pos',
  commit: 'POS-ACTION-BAR-TEXT-ONLY-01488',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Retail POS Action Bar Text Only',
  updatedAt: '2026-07-16T21:45:00+07:00',
  whatsNew: [
    'Remove the FOD badge from Retail POS action bars and Customer Display',
    'Keep Retail POS page titles and descriptions text-only across submenus',
    'Prevent the shared icon enhancer from injecting icons into action-bar titles'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
