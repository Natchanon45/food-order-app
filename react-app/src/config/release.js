export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.03.375",
  branch: "feature/react-firebase-port",
  commit: "POS-RETURNS-REACT-CUTOVER",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Retail POS returns React cutover",
  whatsNew: [
    "Serve Retail POS returns on the canonical /pos/returns URL with the React runtime",
    "Preserve legacy return and VOID confirmation, stock restoration, loyalty adjustment, history, receipt, and barcode scan behavior",
    "Keep logical IDs and Firestore document IDs compatible with existing Retail POS data",
  ],
});
