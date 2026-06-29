export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.11.5',
  build: '2026.06.29.042',
  branch: 'feature/retail-pos',
  commit: '8c93461',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B019 POS Purchases Firebase',
  updatedAt: '2026-06-29T21:05:00+07:00',
  whatsNew: [
    'รับสินค้าเข้าเขียน Firebase tenant',
    'อัปเดตสินค้าและ stock movements ใน Firebase',
    'localStorage ใช้เป็น cache'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
