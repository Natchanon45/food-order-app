export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.10.7',
  build: '2026.06.29.034',
  branch: 'feature/retail-pos',
  commit: '127a8b6',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B011 POS Offline Queue Hardening',
  updatedAt: '2026-06-29T14:55:00+07:00',
  whatsNew: [
    'เพิ่มสถานะ offline sale queue: pending, syncing, synced, failed, conflict',
    'เพิ่ม syncAttemptCount, syncLockId และ lastSyncAttemptAt',
    'กัน sync ซ้ำเมื่อพบ sale เดิมใน Firebase'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
