export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.09.492",
  branch: "feature/react-firebase-port",
  commit: "DELIVERY-GPS-SAVED-PIN-INTEGRITY",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Protect current GPS and saved address pins, confirm delivery destination",
  whatsNew: [
    "Keep GPS location separate from saved-address pins and require customer delivery pin confirmation",
    "Share customer-confirmed Delivery map pins with store-managed drivers using Google Maps",
    "Verify Restaurant Delivery PromptPay slips with central PENGUIN Slip2Go credits against each store's own PromptPay receiver",
    "Auto-release matched payments to Kitchen while routing unavailable or non-verifiable checks to trusted Cashier review",
    "Keep every Delivery visible to Cashier, admit COD immediately, and block unpaid prepayment orders from Kitchen",
  ],
});
