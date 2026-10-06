export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.06.431",
  branch: "feature/react-firebase-port",
  commit: "TAKEAWAY-DOCID-CANONICALIZATION",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Takeaway legacy document ID compatibility",
  whatsNew: [
    "Use the real Firestore document ID for legacy Take Away orders even when embedded id differs",
    "Restore Cashier and Kitchen actions for legacy Take Away records without duplicating documents",
    "Preserve mismatched historical payload IDs as legacyId for compatibility and diagnostics",
  ],
});
