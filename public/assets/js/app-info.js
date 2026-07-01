export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.52',
  build: '2026.07.02.006',
  branch: 'feature/retail-pos',
  commit: 'POS-SALE-RULES-HOTFIX-006',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B005 Repository Layer Hotfix',
  updatedAt: '2026-07-02T00:00:00+07:00',
  whatsNew: [
    'Fix POS sale transaction permission denied when checking stable saleId',
    'Allow POS transaction to read a not-yet-created sale document for duplicate protection',
    'Keep existing sale read restricted to tenant members or the cashier that created the sale',
    'No POS UI flow change required'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
