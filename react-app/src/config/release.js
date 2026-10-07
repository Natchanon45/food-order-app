export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.07.452",
  branch: "feature/react-firebase-port",
  commit: "POS-BACKUP-TYPED-SCOPED-RESTORE",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Retail POS React cutover with safe typed restore",
  whatsNew: [
    "Complete the React cutover for /pos/backup and /pos/users",
    "Upgrade POS backups to version 2 with exact Firestore typed values and POS numbering/integrity data",
    "Scope restore away from shared Admin, Delivery, Lalamove, Quick Order settings, counters, and held bills",
  ],
});
