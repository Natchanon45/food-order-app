export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.40',
  build: '2026.07.01.022',
  branch: 'feature/retail-pos',
  commit: 'O1-UI-022',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Kitchen Visual Cues',
  updatedAt: '2026-07-01T20:55:00+07:00',
  whatsNew: [
    'Add soft pulse animation to Kitchen accept order action',
    'Keep animated hourglass for Kitchen start action',
    'Add soft check animation to Kitchen ready action',
    'Highlight orders waiting longer than 15 minutes'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
