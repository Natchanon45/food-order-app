export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.09.493",
  branch: "feature/react-firebase-port",
  commit: "DELIVERY-LARAVEL-NEAREST-STORE-DRIVER-ROUTE",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Auto-select nearby saved address from GPS and share store-to-customer directions",
  whatsNew: [
    "Keep GPS location separate from saved-address pins and require customer delivery pin confirmation",
    "Share customer-confirmed Delivery map pins with store-managed drivers using Google Maps",
    "Verify Restaurant Delivery PromptPay slips with central PENGUIN Slip2Go credits against each store's own PromptPay receiver",
    "Auto-release matched payments to Kitchen while routing unavailable or non-verifiable checks to trusted Cashier review",
    "Keep every Delivery visible to Cashier, admit COD immediately, and block unpaid prepayment orders from Kitchen",
  ],
});
