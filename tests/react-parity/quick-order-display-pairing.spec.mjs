import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = filename => fs.readFileSync(filename, "utf8");
const quick = read("react-app/src/pages/QuickOrderPage.jsx");
const display = read("react-app/src/pages/PosCustomerDisplayPage.jsx");
const app = read("react-app/src/app/App.jsx");

test("Quick Order uses a restaurant customer-display route, not Retail POS", () => {
  assert.match(quick, /const customerDisplayLink = \`\/cashier\/customer-display\?displayId=/);
  assert.match(app, /<Route path="\/cashier\/customer-display" element=\{<PosCustomerDisplayPage \/>} \/>/);
  assert.match(display, /displayId\.startsWith\("quick-order-"\) \? "\/cashier\/quick-order" : "\/pos"/);
});

test("QR pairing preserves its target display ID even for another cashier login", () => {
  assert.match(display, /url\.searchParams\.set\("displayId", displayId\)/);
  assert.match(quick, /const pairedDisplayId = displayParams\.get\("displayId"\) \|\| displayParams\.get\("registerId"\)/);
  assert.match(quick, /const displayId = \/\^quick-order-/);
  assert.match(quick, /id: displayId, tenantId: tenant\.id/);
  assert.match(quick, /await updateCustomerDisplay\(tenant\.id, displayId, snapshot\)/);
});

test("login retains the scanned display ID", () => {
  assert.match(quick, /encodeURIComponent\(location\.pathname \+ location\.search\)/);
  assert.match(display, /encodeURIComponent\(location\.pathname \+ location\.search\)/);
});

test("restaurant-only merchants may open a Quick Order display, without enabling retail POS", () => {
  assert.match(app, /const isQuickOrderDisplay = pathname === "\/pos\/customer-display"/);
  assert.match(app, /&& !isQuickOrderDisplay/);
  assert.match(app, /\|\| isQuickOrderDisplay/);
  assert.match(app, /const allowsPos = master \? \["retail", "both"\]/);
});
