export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.10.4',
  build: '2026.06.29.031',
  branch: 'feature/retail-pos',
  commit: 'a64f312',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B008 Tenant Loyalty Settings',
  updatedAt: '2026-06-29T13:35:00+07:00',
  whatsNew: [
    'บันทึกกติกาแต้มที่ tenants/{tenantId}/settings/loyalty',
    'ซิงก์กติกาแต้มให้ทุกเครื่อง POS แบบ realtime',
    'ใช้กติกากลางเดียวกันเมื่อขายและคืนสินค้า'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
