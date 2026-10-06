export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.06.430",
  branch: "feature/react-firebase-port",
  commit: "TAKEAWAY-CANCEL-LALAMOVE-RESTORE",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Takeaway cancellation and Lalamove logic restore",
  whatsNew: [
    "Restore the original Lalamove local-cancel lock and separate provider cancellation flow",
    "Fix Take Away whole-order cancellation in Cashier through the proven status-update path",
    "Fix Take Away whole-order cancellation in Kitchen with Laravel-parity zeroed totals",
  ],
});
