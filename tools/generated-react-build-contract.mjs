import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function currentReactBuild() {
  const release = read("react-app/src/config/release.js");
  const match = release.match(/build:\s*"([^"]+)"/);
  assert(match, "Unable to read React release build");
  return match[1];
}

function bundleFromEntry(relativeEntry) {
  const html = read(relativeEntry);
  const match = html.match(/src="(\/react\/assets\/index-[^"]+\.js)"/);
  assert(match, `React bundle reference missing from ${relativeEntry}`);
  const relativeBundle = match[1].replace(/^\//, "");
  const fullPath = path.join(root, "public", relativeBundle.replace(/^react\//, "react/"));
  assert(fs.existsSync(fullPath), `Referenced React bundle does not exist: ${match[1]}`);
  return {
    ref: match[1],
    source: fs.readFileSync(fullPath, "utf8"),
  };
}

const build = currentReactBuild();
const reactIndex = read("public/react/index.html");
const toastPolicyPath = path.join(root, "public/react/parity/css/toast-global-policy.css");
assert(reactIndex.includes("/react/parity/css/toast-global-policy.css"), "Generated React shell must load the global Toast presentation policy");
assert(fs.existsSync(toastPolicyPath), "Generated React Toast presentation policy file is missing");
const generatedToastPolicy = fs.readFileSync(toastPolicyPath, "utf8");
assert(generatedToastPolicy.includes("top: 75vh !important;") && generatedToastPolicy.includes("color: #22c55e !important;") && generatedToastPolicy.includes("color: #ef4444 !important;"), "Generated React Toast policy is missing the 75vh/green-success/red-error rules");
const receipt = bundleFromEntry("public/cashier/receipt/index.html");
const posSale = bundleFromEntry("public/pos/index.html");
const posSalesHistory = bundleFromEntry("public/pos/sales/index.html");
const posTaxInvoicesHistory = bundleFromEntry("public/pos/tax-invoices/index.html");
const posReturns = bundleFromEntry("public/pos/returns/index.html");
const posShifts = bundleFromEntry("public/pos/shifts/index.html");

assert(
  receipt.source.includes(build),
  `Generated React bundle ${receipt.ref} is stale: expected release Build ${build}`
);
assert(receipt.source.includes("PENGUIN"), `Generated React bundle ${receipt.ref} is missing the PENGUIN visible brand`);
assert.equal(posSale.ref, receipt.ref, "Canonical /pos root must use the current React bundle");
assert.equal(posSalesHistory.ref, receipt.ref, "Canonical /pos/sales must use the current React bundle");
assert.equal(posTaxInvoicesHistory.ref, receipt.ref, "Canonical /pos/tax-invoices must use the current React bundle");
assert.equal(posReturns.ref, receipt.ref, "Canonical /pos/returns must use the current React bundle");
assert.equal(posShifts.ref, receipt.ref, "Canonical /pos/shifts must use the current React bundle");
assert(posSale.source.includes("pos.sale"), "Canonical /pos generated bundle is missing the Retail POS sale route");
assert(posSalesHistory.source.includes("pos.sales"), "Canonical /pos/sales generated bundle is missing the Retail POS sales-history route");
assert(posTaxInvoicesHistory.source.includes("pos.tax_invoices"), "Canonical /pos/tax-invoices generated bundle is missing the Retail POS tax-invoice-history route");
assert(posReturns.source.includes("pos.returns"), "Canonical /pos/returns generated bundle is missing the Retail POS returns route");
assert(posShifts.source.includes("pos.shifts"), "Canonical /pos/shifts generated bundle is missing the Retail POS shifts route");

const backIndex = receipt.source.indexOf("cashier_documents.receipt.back");
assert(backIndex >= 0, "Cashier Receipt back label missing from generated bundle");
const backWindow = receipt.source.slice(Math.max(0, backIndex - 1400), backIndex + 1400);
assert(
  backWindow.includes("bi bi-arrow-left app-icon"),
  "Cashier Receipt generated bundle is missing the Back arrow icon"
);

const printIndex = receipt.source.indexOf("printButton");
assert(printIndex >= 0, "Cashier Receipt print button missing from generated bundle");
const printWindow = receipt.source.slice(Math.max(0, printIndex - 1400), printIndex + 1400);
assert(
  printWindow.includes("bi bi-check-lg app-icon"),
  "Cashier Receipt generated bundle is missing the Print check icon"
);

console.log(`Generated React build contract: PASS (${build}, ${receipt.ref})`);
