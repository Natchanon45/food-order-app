export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.03.373",
  branch: "feature/react-firebase-port",
  commit: "CANONICAL-URL-CUTOVER",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Retail POS tax-invoice history React cutover",
  whatsNew: [
    "Serve Retail POS tax-invoice history on the canonical /pos/tax-invoices URL with the React runtime",
    "Preserve legacy issue, DBD lookup, buyer profile, void, sync recovery, filters, and print actions",
    "Reuse the production tax invoice sync/offline engine without changing Firestore identifiers or schema",
  ],
});
