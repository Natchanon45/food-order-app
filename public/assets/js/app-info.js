export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.18',
  build: '2026.08.01.100',
  branch: 'feature/retail-pos',
  commit: 'TAKEAWAY-ALERT-VALIDATION-01518',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Take Away Kitchen Alerts',
  updatedAt: '2026-08-01T04:35:00+07:00',
  whatsNew: [
    'Play the enabled kitchen alert for new Take Away orders',
    'Show red validation on both missing pickup-contact fields',
    'Label the accepted-order action as เริ่มทำ'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
