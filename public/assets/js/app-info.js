export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.0',
  build: '2026.06.28.007',
  branch: 'feature/retail-pos',
  commit: '2a978f9',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'M3-B007 Mobile POS Polish',
  updatedAt: '2026-06-28T18:18:00+07:00',
  whatsNew: [
    'ปรับ Header บนมือถือให้เตี้ยและกระชับขึ้น',
    'ปรับ Search, Action Buttons และระยะห่างของ Panel บนมือถือ',
    'ปรับ Category Tabs ให้ปัดง่ายและไม่กินพื้นที่แนวตั้ง',
    'ปรับ Product Grid และ Cart spacing สำหรับจอเล็ก'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
