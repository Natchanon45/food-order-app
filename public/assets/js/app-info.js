export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.6',
  build: '2026.06.30.072',
  branch: 'feature/retail-pos',
  commit: 'c1d7913',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P8-B002 OAuth Public Pages And Icon Polish',
  updatedAt: '2026-06-30T12:30:00+07:00',
  whatsNew: [
    'Polish dashboard and user-menu SVG icons',
    'Add public landing, privacy policy, and terms pages for Google OAuth readiness',
    'Improve Google Login error messages for customer delivery flow',
    'Keep POS offline sync safeguards and tenant-safe sale records'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
