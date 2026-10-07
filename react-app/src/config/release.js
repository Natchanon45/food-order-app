export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.07.440",
  branch: "feature/react-firebase-port",
  commit: "POS-CUSTOMERS-DIALOG-OK-I18N-FIX",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "POS Customers dialog OK translation repair",
  whatsNew: [
    "Fix the Customer cannot-delete alert so the OK button uses the localized shared.actions.ok label",
    "Apply the same localized OK key correction to Customer delete-error and Supplier delete alerts",
    "Add regression guards preventing the obsolete shared.action.ok key from returning raw text",
  ],
});
