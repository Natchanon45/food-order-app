export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.04.383",
  branch: "feature/react-firebase-port",
  commit: "POS-STOCK-MOVEMENTS-REACT-CUTOVER",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Retail POS stock movements React cutover",
  whatsNew: [
    "Serve canonical /pos/stock-movements from React while preserving the 17-ID legacy report/filter surface",
    "Keep exact legacy note-based movement classification, quantity/export permissions, realtime data, CSV export, and barcode product filtering",
    "Preserve task2 semantic icons, scanner/clear controls, mobile card behavior, global Toast/dialog rules, and bounded readiness",
  ],
});
