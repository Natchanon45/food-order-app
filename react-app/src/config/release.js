export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.07.457",
  branch: "feature/react-firebase-port",
  commit: "FULL-REACT-SYSTEM-CUTOVER",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Full React system cutover",
  whatsNew: [
    "Move the remaining public storefront, legal, verification, and POS utility entrypoints onto the canonical React shell",
    "Replace legacy Delivery and Takeaway page runtimes with native React/Firebase flows while preserving Maps, Lalamove, promotions, PromptPay, slips, favorites, and customer addresses",
    "Guard every physical frontend index entry and Hosting rewrite so future builds cannot fall back to page-specific legacy HTML",
  ],
});
