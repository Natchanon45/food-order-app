export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.12.12',
  build: '2026.06.30.078',
  branch: 'feature/retail-pos',
  commit: 'P9-B003.1',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P9-B003.1 POS Menu Open Fix',
  updatedAt: '2026-06-30T19:35:00+07:00',
  whatsNew: [
    'Fix POS hamburger menu not opening by supporting existing open class',
    'Keep duplicate hamburger icon cleanup from P9-B003',
    'Continue stable POS counter document metadata',
    'Add POS navigation CSS cache update note'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
