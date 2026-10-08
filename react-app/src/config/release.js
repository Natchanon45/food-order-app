export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.08.486",
  branch: "feature/react-firebase-port",
  commit: "DELIVERY-MOBILE-FILTERS-FIXED",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Pin delivery mobile categories and search together",
  whatsNew: [
    "Verify Restaurant Delivery PromptPay slips with central PENGUIN Slip2Go credits against each store's own PromptPay receiver",
    "Auto-release matched payments to Kitchen while routing unavailable or non-verifiable checks to trusted Cashier review",
    "Keep every Delivery visible to Cashier, admit COD immediately, and block unpaid prepayment orders from Kitchen",
  ],
});
