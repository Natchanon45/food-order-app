export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.47',
  build: '2026.07.01.030',
  branch: 'feature/retail-pos',
  commit: 'TABLE-ORDER-030',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Customer Previous Orders Table Code Fix',
  updatedAt: '2026-07-01T23:40:00+07:00',
  whatsNew: [
    'Show customer previous orders from the current tableCode, tableToken, and movedFromTableCode',
    'Restore normal dine-in table previous rounds before table-move testing',
    'Keep old QR moved-table previous rounds fallback',
    'Show Admin menu/table active status as icon-only check-square or square'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
