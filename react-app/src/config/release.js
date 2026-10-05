export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.05.425",
  branch: "feature/react-firebase-port",
  commit: "POS-SCANNER-TOAST-DEDUP",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "React POS scanner toast de-duplication",
  whatsNew: [
    "Show exactly one scanner Toast result per camera scan on canonical React /pos",
    "Show scanner success only after the product is actually added to the sale cart",
    "Ignore duplicate camera callbacks so one scan cannot add or notify twice",
  ],
});
