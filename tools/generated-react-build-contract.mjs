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
const receipt = bundleFromEntry("public/cashier/receipt/index.html");

assert(
  receipt.source.includes(build),
  `Generated React bundle ${receipt.ref} is stale: expected release Build ${build}`
);
assert(receipt.source.includes("PENGUIN"), `Generated React bundle ${receipt.ref} is missing the PENGUIN visible brand`);

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
