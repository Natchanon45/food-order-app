export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.0',
  build: '2026.06.28.015',
  branch: 'feature/retail-pos',
  commit: '2989d52',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P6-B001 Professional Barcode Workflow',
  updatedAt: '2026-06-28T20:32:00+07:00',
  whatsNew: [
    'เพิ่มระบบ focus กลับช่อง Barcode อัตโนมัติหลังเพิ่มสินค้า',
    'เพิ่ม scan feedback แบบ flash เขียวเมื่อสินค้าเข้าบิล',
    'กัน focus หลุดระหว่างยิงบาร์โค้ดต่อเนื่อง',
    'หลังปิด dialog หรือกลับหน้า POS จะพร้อมยิงบาร์โค้ดต่อทันที'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
