export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.04.382",
  branch: "feature/react-firebase-port",
  commit: "POS-PRODUCTS-READINESS",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Retail POS products readiness resilience",
  whatsNew: [
    "Use cached or built-in POS roles immediately so Products cannot hang behind a slow role-settings read",
    "Timeout initial Products data loading safely and let realtime Firestore watchers continue recovery",
    "Retain the Build .381 Products cutover, 60-ID parity, permissions, barcode scanning, sorting, and legacy document-ID safeguards",
  ],
});
