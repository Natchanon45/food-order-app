export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.93',
  build: '2026.07.17.001',
  branch: 'feature/retail-pos',
  commit: 'CATALOG-HERO-MOBILE-01493',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Catalog Hero Mobile Organization',
  updatedAt: '2026-07-17T00:15:00+07:00',
  whatsNew: [
    'Rename the catalog hero to นำเข้าชุดสินค้าพื้นฐาน',
    'Place the นำเข้าทั้งหมด action beside the hero heading with an import icon',
    'Polish catalog hero spacing, description flow, and full-width mobile actions'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
