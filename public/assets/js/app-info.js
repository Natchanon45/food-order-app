export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.51',
  build: '2026.07.02.005',
  branch: 'feature/retail-pos',
  commit: 'POS-REPOSITORY-LAYER-005',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B005 Repository Layer',
  updatedAt: '2026-07-02T00:00:00+07:00',
  whatsNew: [
    'Expand POS Repository Layer with tenant-aware repository factory',
    'Add shared repositories for products, sales, stock movements, shifts, returns, sync queue, audit logs, and counters',
    'Add tenant metadata and tenant mismatch guard helpers',
    'Keep existing offline sync and local sale APIs backward compatible'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
