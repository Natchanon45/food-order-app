export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.03.372",
  branch: "feature/react-firebase-port",
  commit: "CANONICAL-URL-CUTOVER",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Retail POS sales-history React cutover",
  whatsNew: [
    "Serve Retail POS sales history on the canonical /pos/sales URL with the React runtime",
    "Preserve legacy sales filters, realtime updates, summaries, CSV export, and receipt actions",
    "Keep remaining Retail POS subroutes on their legacy entrypoints until migrated individually",
  ],
});
