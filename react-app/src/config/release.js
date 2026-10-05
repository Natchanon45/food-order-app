export const REACT_RELEASE = Object.freeze({
  product: "PENGUIN",
  version: "0.4.280",
  build: "2026.10.05.421",
  branch: "feature/react-firebase-port",
  commit: "STOREFRONT-SHOP-NAME-SOURCE",
  dataService: "Firebase / Firestore",
  environment: "production",
  milestone: "Storefront shop name source isolation",
  whatsNew: [
    "Use Store Settings shopName as the only customer-facing Delivery shop-name source",
    "Keep the Super Admin tenant name isolated from Delivery Hero and Delivery Success receipt",
    "Preserve tenant routing, permissions, order data, and delivery business logic",
  ],
});
