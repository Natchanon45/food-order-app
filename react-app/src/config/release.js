export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.07.437",
  branch: "feature/react-firebase-port",
  commit: "POS-PURCHASES-ASYNC-PRODUCT-PICKER",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "POS Purchases async lazy product picker",
  whatsNew: [
    "Replace the Purchases product dropdown with a searchable async picker",
    "Load product options in 30-item Firestore pages instead of loading the full catalog",
    "Use exact lazy product lookup for barcode scanning while keeping purchase transactions unchanged",
  ],
});
