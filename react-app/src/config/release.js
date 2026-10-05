export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.05.422",
  branch: "feature/react-firebase-port",
  commit: "POS-SETTINGS-REACT-CUTOVER",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "React POS Settings control center",
  whatsNew: [
    "Migrate canonical /pos/settings to the React POS Settings Control Center",
    "Preserve store, VAT, PromptPay, receipt, loyalty, map, and five-theme settings behavior",
    "Keep store and loyalty writes permission-scoped while retaining tenant-safe Firestore paths",
  ],
});
