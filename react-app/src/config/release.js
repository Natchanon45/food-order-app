export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.04.381",
  branch: "feature/react-firebase-port",
  commit: "POS-PRODUCTS-REACT-CUTOVER",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Retail POS products React cutover",
  whatsNew: [
    "Serve canonical /pos/products from React while preserving the 60-ID legacy product/category/stock/sort surface",
    "Keep realtime products, categories, stock movements, catalog order, barcode scanning, permissions, dialogs, and Toast behavior",
    "Protect legacy Firestore product document IDs during edit, stock adjustment, delete, and sort-order writes",
  ],
});
