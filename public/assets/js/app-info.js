export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.9',
  build: '2026.06.29.024',
  branch: 'feature/retail-pos',
  commit: '28429b7',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B003 TH Sarabun Receipt Font',
  updatedAt: '2026-06-29T08:15:00+07:00',
  whatsNew: [
    'เปลี่ยนใบเสร็จ POS เป็น TH Sarabun PSK Local',
    'ใช้ฟอนต์จาก assets/fonts/THSarabun.ttf และ THSarabun-Bold.ttf',
    'ปรับขนาดตัวอักษรใบเสร็จให้เหมาะกับ thermal print'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
