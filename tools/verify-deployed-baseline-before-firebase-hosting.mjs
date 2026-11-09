#!/usr/bin/env node
/**
 * Manual, fail-closed release preflight for the already-live October 31
 * PENGUIN Firebase Hosting baseline. This script never deploys anything.
 * Run: node tools/verify-deployed-baseline-before-firebase-hosting.mjs
 *
 * A PASS is NECESSARY, never sufficient: run emulator and live-browser UAT.
 * Source code may evolve beyond Oct31 but must retain the reviewed behaviors.
 */
import { readFileSync } from "node:fs";

const preserved = [
  {
    title: "Super Admin preserves source-equivalent Firebase read guards",
    path: "react-app/src/pages/PlatformPage.jsx",
    mustInclude: ["brandingReadReady", "googleReadReady", "slipReadReady", "lalamoveReadReady"],
  },
  {
    title: "Owner-uploaded favicon appears in print receipts and QR/queue tabs",
    path: "react-app/src/components/AdminDeliveryQr.jsx",
    mustInclude: ["printFaviconLink()"],
  },
  {
    title: "Quick Order keeps deployed green UI and server-priced append",
    path: "react-app/src/pages/QuickOrderPage.jsx",
    mustInclude: ["quick-order-emerald-port.css", "appendUnpaidWalkInItems"],
  },
  {
    title: "Cashier keeps paid/unserved Walk-in in the right state",
    path: "react-app/src/pages/CashierPage.jsx",
    mustInclude: ["walkInCashierPending"],
  },
  {
    title: "Kitchen keeps paid-but-unserved Walk-in visible",
    path: "react-app/src/pages/KitchenPage.jsx",
    mustInclude: ["walkInKitchenPending", "walkInKitchenStatus"],
  },
  {
    title: "Cancelled receipts remain visible and visibly marked",
    path: "react-app/src/pages/CashierReceiptPage.jsx",
    mustInclude: ["receipt-cancelled-watermark", "receipt-cancelled-code"],
  },
  {
    title: "Cancelled sales do not contribute to the sales KPIs",
    path: "react-app/src/pages/AdminSalesReportPage.jsx",
    mustInclude: ["reportedSalesNet", "historicalReceiptNet"],
  },
  {
    title: "Revenue Share reporting uses calendar filters independent of billing",
    path: "react-app/src/pages/RevenueShareReportPage.jsx",
    mustInclude: ["reportingQuery(periodPayload)", "revenue-share-wallet-scroll-port.css"],
  },
  {
    title: "Quick Order route-scoped emerald CSS exists",
    path: "react-app/public/parity/css/quick-order-emerald-port.css",
    mustInclude: ["body.quick-order-page"],
  },
  {
    title: "Walk-in write operations remain server-owned",
    path: "functions/index.js",
    mustInclude: [
      "exports.appendUnpaidWalkInItems",
      "exports.settleDeferredWalkIn",
      "exports.updateDeferredKitchen",
      "exports.cancelReviewedPaidWalkIn",
    ],
  },
  {
    title: "Walk-in transactional implementation remains present",
    path: "functions/operational-orders.js",
    mustInclude: ["exports.appendUnpaidWalkInItems", "exports.settleDeferredWalkIn", "exports.cancelReviewedPaidWalkIn"],
  },
  {
    title: "Client direct writes to protected Walk-in orders remain denied",
    path: "firestore.rules",
    mustInclude: ["request.resource.data.get('orderType', '') != 'walkin'", "resource.data.get('orderType', '') != 'walkin'"],
  },
];

const failures = [];
for (const item of preserved) {
  let source = "";
  try { source = readFileSync(item.path, "utf8"); }
  catch { failures.push(`${item.title}: missing file ${item.path}`); continue; }
  for (const fragment of item.mustInclude) {
    if (!source.includes(fragment)) failures.push(`${item.title}: missing ${JSON.stringify(fragment)} in ${item.path}`);
  }
}
if (failures.length) {
  console.error(`LIVE_BASELINE_RECONCILIATION_BLOCKED: ${failures.length} missing contract(s)`);
  failures.forEach(failure => console.error(" - " + failure));
  console.error("Do not deploy Hosting from this branch. Import and verify each live behavior, then rerun this preflight plus emulator/browser UAT.");
  process.exitCode = 1;
} else {
  console.log("LIVE_BASELINE_SOURCE_CONTRACTS_PRESENT (" + preserved.length + " groups)");
  console.log("This does not certify an authorized release. Emulator, authenticated visual/UAT and release checks are still mandatory.");
}
