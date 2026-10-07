export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.07.446",
  branch: "feature/react-firebase-port",
  commit: "TABLE-PERMANENT-QR-SESSION-RESOLVER",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Permanent table QR session resolver",
  whatsNew: [
    "Restore permanent table QR ordering after a cashier opens the table",
    "Resolve tokenless table links to the current occupied table session automatically",
    "Keep unavailable tables blocked while preserving tokenized session validation",
  ],
});
