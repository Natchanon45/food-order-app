export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.07.458",
  branch: "feature/react-firebase-port",
  commit: "REACT-ONLY-FRONTEND-RUNTIME",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "React-only frontend runtime",
  whatsNew: [
    "Remove the remaining page-specific legacy JavaScript and CSS runtime trees from Firebase Hosting",
    "Move horizontal scrolling, SaaS confirmation, POS tax-invoice sync, and Platform receiver controls fully into React-owned code",
    "Retain only React bundles, React parity styles, required static assets, and compatibility URLs that resolve to the React shell",
  ],
});
