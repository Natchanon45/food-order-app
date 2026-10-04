export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.04.385",
  branch: "feature/react-firebase-port",
  commit: "POS-STOCK-COUNTS-REACT-CUTOVER",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Retail POS stock counts React cutover",
  whatsNew: [
    "Serve canonical /pos/stock-counts from React while preserving the 21-ID legacy count/history surface",
    "Keep stock-count permissions, realtime products/history, barcode scanning, translated confirmations, and legacy mobile-card behavior",
    "Preserve legacy count/history schema compatibility and stock-role Firestore compatibility without a Rules deployment",
  ],
});
