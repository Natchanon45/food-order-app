export const APP_INFO = {
  name: 'Food Order Delivery',
  product: 'Food Order Delivery',
  version: '0.14.56',
  build: '2026.07.13.004',
  branch: 'feature/retail-pos',
  commit: 'SYSTEM-UI-FONT-WEIGHT-01456',
  firebaseProject: 'chat-45754',
  repository: 'Natchanon45/food-order-app',
  environment: 'production',
  milestone: 'System UI Font Weight Tuning',
  updatedAt: '2026-07-13T00:00:00+07:00',
  whatsNew: [
    'Tune shared UI font weights so local Kanit renders lighter and easier to read across the system',
    'Add shared UI weight variables for Order, Delivery, and Retail POS surfaces',
    'Reduce heavy sort-manager headings, badges, and buttons from 900-level weights to 500-600',
    'Keep printable receipt and tax invoice paper font behavior unchanged'
  ]
};

export function appVersionText() {
  return `v${APP_INFO.version} • Build ${APP_INFO.build}`;
}
