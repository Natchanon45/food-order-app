export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.10.9',
  build: '2026.06.29.036',
  branch: 'feature/retail-pos',
  commit: 'f8604f1',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B013 POS Role Fallback',
  updatedAt: '2026-06-29T15:35:00+07:00',
  whatsNew: [
    'ปรับการโหลดสิทธิ์ POS จาก Firebase',
    'เพิ่ม fallback settings roles',
    'คง localStorage เป็น cache'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
