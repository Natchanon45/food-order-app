export const APP_INFO = {
  name: 'Food Order App',
  product: 'Retail POS',
  version: '0.10.5',
  build: '2026.06.29.032',
  branch: 'feature/retail-pos',
  commit: 'bb1951e',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'P7-B009 Tenant Operational Records',
  updatedAt: '2026-06-29T14:10:00+07:00',
  whatsNew: [
    'บันทึกบิลพักที่ tenants/{tenantId}/heldBills แบบ strict',
    'บันทึกกะพนักงานที่ tenants/{tenantId}/shifts',
    'บันทึกคืนสินค้าและปรับ loyalty ใน Firebase transaction เดียวกัน'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
