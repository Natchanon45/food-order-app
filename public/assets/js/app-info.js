export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.9.0',
  build: '2026.06.28.013',
  branch: 'feature/retail-pos',
  commit: '348f70c',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P4-B003S Developer Dot Center Fix',
  updatedAt: '2026-06-28T20:03:00+07:00',
  whatsNew: [
    'ล็อก padding ของ Developer Dot เป็น 0 ด้วย !important',
    'ล็อกขนาด Dot และจุดขาวด้านในให้กึ่งกลางทั้ง Desktop/Mobile',
    'กัน CSS badge เก่าทับตำแหน่งและ padding',
    'ยังคงกด Dot เพื่อเปิด Developer Panel ได้เหมือนเดิม'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
