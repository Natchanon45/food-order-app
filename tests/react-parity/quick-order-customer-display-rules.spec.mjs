import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rules = fs.readFileSync("firestore.rules", "utf8");
const quick = fs.readFileSync("react-app/src/pages/QuickOrderPage.jsx", "utf8");
const display = fs.readFileSync("react-app/src/pages/PosCustomerDisplayPage.jsx", "utf8");
const data = fs.readFileSync("react-app/src/data/operationalData.js", "utf8");

function customerDisplayRule() {
  const from = rules.indexOf("match /customerDisplays/{displayId} {");
  const to = rules.indexOf("match /heldBills/{heldBillId}", from);
  assert.ok(from > 0 && to > from);
  return rules.slice(from, to);
}

test("Quick Order display reads require matching restaurant module, ID and tenant membership", () => {
  const scope = customerDisplayRule();
  assert.ok(scope.includes("allow get: if (tenantBusinessEnabled(tenantId, 'retail_pos') && tenantMember(tenantId))"));
  assert.ok(scope.includes("tenantBusinessEnabled(tenantId, 'order_delivery')"));
  assert.ok(scope.includes("displayId.matches('quick-order-.*') && tenantMember(tenantId)"));
  assert.ok(scope.includes("allow list: if tenantBusinessEnabled(tenantId, 'retail_pos') && tenantMember(tenantId)"));
  assert.ok(!scope.includes("allow read: if true"));
});

test("Restaurant writers require staff role, own tenant and matching paired display identifier", () => {
  const scope = customerDisplayRule();
  for (const required of [
    "tenantHasRole(tenantId, ['owner', 'admin', 'manager', 'cashier', 'super_admin'])",
    "tenantPayloadMatches(tenantId)",
    "request.resource.data.get('id', '') == displayId",
    "request.resource.data.get('displayId', '') == displayId",
    "request.resource.data.get('registerId', '') == displayId",
    "request.resource.data.get('tenantId', '') == tenantId",
    "request.resource.data.get('shopId', '') == tenantId",
    "request.resource.data.get('items', []) is list",
    "request.resource.data.get('items', []).size() <= 100",
  ]) assert.ok(scope.includes(required), required);
  assert.ok(scope.includes("allow delete: if tenantBusinessEnabled(tenantId, 'retail_pos')"));
});

test("Retail POS authorization remains in place and restaurant cannot read heldBills", () => {
  const scope = customerDisplayRule();
  assert.ok(scope.includes("retailTenantWrite(tenantId) && tenantPayloadMatches(tenantId)"));
  assert.ok(scope.includes("tenantAdminRole(tenantId) && tenantResourceMatches(tenantId)"));
  const held = rules.slice(rules.indexOf("match /heldBills/{heldBillId}"), rules.indexOf("match /shifts/{shiftId}"));
  assert.ok(held.includes("allow read: if tenantBusinessEnabled(tenantId, 'retail_pos')"));
  assert.ok(held.includes("allow create, update: if tenantBusinessEnabled(tenantId, 'retail_pos')"));
});

test("Quick Order publishes a paired tenant document that the customer screen watches", () => {
  for (const token of [
    "const displayId = /^quick-order-",
    "const customerDisplayLink = ",
    "id: displayId, tenantId: tenant.id, registerId: displayId",
    "await updateCustomerDisplay(tenant.id, displayId, snapshot)",
  ]) assert.ok(quick.includes(token), token);
  assert.ok(data.includes('tenantDoc(tenantId, "customerDisplays", id)'));
  assert.ok(data.includes('return onSnapshot(tenantDoc(tenantId, "customerDisplays", id)'));
  assert.ok(display.includes("watchCustomerDisplay("));
  assert.ok(display.includes("setSnapshot(value || null)"));
});
