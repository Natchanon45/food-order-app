export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.0',
  build: '2026.06.28.011',
  branch: 'feature/retail-pos',
  commit: '3b9be64',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P4-B003 Developer Dot',
  updatedAt: '2026-06-28T19:16:00+07:00',
  whatsNew: [
    'เปลี่ยน Version Badge ยาวเป็น Developer Dot ขนาดเล็ก',
    'ลดการบัง Bottom Cart และยอดรวมบนมือถือ',
    'กด Dot เพื่อเปิด Developer Panel ได้เหมือนเดิม',
    'เตรียมรองรับสี Dot ตาม Environment: production, staging, local'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
