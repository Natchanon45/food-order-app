export const REACT_RELEASE = Object.freeze({
  product: "KINJAI",
  version: "0.4.280",
  build: "2026.10.01.306",
  branch: "feature/react-firebase-port",
  commit: "CANONICAL-URL-CUTOVER",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Canonical no-/react production cutover",
  whatsNew: [
    "Serve migrated operational pages on the existing production URLs without /react",
    "Keep customer Order / Delivery / Takeaway URLs unchanged",
    "Preserve legacy POS entrypoints until the paused POS migration is resumed",
  ],
});
