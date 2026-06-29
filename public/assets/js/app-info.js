export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.10.1',
  build: '2026.06.29.026',
  branch: 'feature/retail-pos',
  commit: '2a51bda',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B005 Tenant Customer Profiles',
  updatedAt: '2026-06-29T08:45:00+07:00',
  whatsNew: [
    'ย้าย customerProfiles ไปใต้ tenants/{tenantId}',
    'ตรวจ push token, QR โต๊ะ และ receipt ว่าใช้ tenant path แล้ว',
    'ไม่แตะ layout หรือ CSS ของ frontend'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
