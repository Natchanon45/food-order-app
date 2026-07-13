export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.55',
  build: '2026.07.13.003',
  branch: 'feature/retail-pos',
  commit: 'UNIFIED-GREEN-UI-ICONS-01455',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Unified Green UI Icon Polish',
  updatedAt: '2026-07-13T00:00:00+07:00',
  whatsNew: [
    'Refresh Order, Delivery, and Retail POS surfaces with the green, black, and white visual system',
    'Add single Bootstrap Icons to main headings and action buttons where appropriate',
    'Guard against adjacent duplicate icons and prevent icon injection inside printable bill headers',
    'Keep the update presentation-only without changing tenant data, VAT, sync, stock, or duplicate protection'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
