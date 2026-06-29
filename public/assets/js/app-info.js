export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.8',
  build: '2026.06.29.023',
  branch: 'feature/retail-pos',
  commit: 'e6ca9a0',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B002 POS Receipt Restore',
  updatedAt: '2026-06-29T08:00:00+07:00',
  whatsNew: [
    'คืนหน้าพิมพ์บิลหลังบันทึกขายสำเร็จ',
    'เพิ่มปุ่มพิมพ์บิลใน modal หลังขาย',
    'รองรับบิล offline ระหว่างรอ Sync Firebase'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
