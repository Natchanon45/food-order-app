export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.68',
  build: '2026.07.15.011',
  branch: 'feature/retail-pos',
  commit: 'UNIFIED-ICON-COLORS-01468',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Unified Icon Color System',
  updatedAt: '2026-07-15T19:26:00+07:00',
  whatsNew: [
    'Unify user menu icon colors across Order/Delivery, Admin, and Retail POS entry pages',
    'Apply the same colored icon language to Admin heading icons injected by the shared icon polish script',
    'Cache-bust shared icon assets so table QR, admin, user, sales report, and POS pages load the same icon color rules',
    'Keep tenant data, stock, VAT, payments, offline sync, duplicate protection, and printable document headers unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
