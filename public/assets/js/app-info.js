export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.10.0',
  build: '2026.06.29.025',
  branch: 'feature/retail-pos',
  commit: '794166f',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B004 Public Tenant Resolver',
  updatedAt: '2026-06-29T08:30:00+07:00',
  whatsNew: [
    'เพิ่ม fallback resolver สำหรับ public tenant slug',
    'รองรับ tenantSlugs และ tenants slug query',
    'ไม่แตะ layout หรือ CSS ของ frontend'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
