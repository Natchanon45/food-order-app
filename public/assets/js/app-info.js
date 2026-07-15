export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.76',
  build: '2026.07.16.001',
  branch: 'feature/retail-pos',
  commit: 'CATALOG-POST-IMPORT-CHECKLIST-01476',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Catalog Post Import Checklist',
  updatedAt: '2026-07-16T00:18:00+07:00',
  whatsNew: [
    'Add a post-import checklist to the Retail Master Catalog success panel',
    'Remind owners to verify prices, set stock, and enable POS visibility only when ready',
    'Keep the checklist as guidance-only UI without changing imported product defaults',
    'Keep tenant data, stock, VAT, payments, offline sync, duplicate protection, and tax invoice transactions unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
