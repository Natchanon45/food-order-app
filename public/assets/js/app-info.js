export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.15.9',
  build: '2026.07.31.091',
  branch: 'feature/retail-pos',
  commit: 'GLOBAL-GREEN-CHECKBOX-THEME-01509',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'Global Green Checkbox Theme',
  updatedAt: '2026-07-31T17:55:00+07:00',
  whatsNew: [
    'Apply the green application theme to native checkboxes across Order/Delivery and Retail POS',
    'Increase checkbox controls to 20 pixels for improved visibility and touch targeting',
    'Preserve native checkbox semantics, keyboard operation, and existing form behavior'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
