import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tenantAccessDecision, effectiveSubscriptionStatus } from "../../react-app/src/auth/tenantAccess.js";

const hybrid = { billingPolicyVersion: "hybrid_v1", active: true };

test("hybrid tenants are not interpreted using legacy monthly subscription expiry", () => {
  const tenant = { ...hybrid, subscriptionExpiresAt: new Date("2024-01-01"), subscriptionStatus: "expired" };
  assert.deepEqual(tenantAccessDecision(tenant, "cashier"), {
    allowed: true, status: "hybrid_billing_active", code: "",
  });
});
test("suspended hybrid tenants preserve owner/admin billing report access but deny staff", () => {
  const suspended = { ...hybrid, active: false, hybridBillingSuspended: true };
  assert.equal(effectiveSubscriptionStatus(suspended), "hybrid_billing_suspended");
  for (const role of ["owner", "admin"]) {
    assert.deepEqual(tenantAccessDecision(suspended, role), {
      allowed: true, status: "hybrid_billing_suspended", code: "",
    });
  }
  for (const role of ["cashier", "kitchen", "manager", "staff"]) {
    assert.equal(tenantAccessDecision(suspended, role).allowed, false);
  }
});
test("manually disabled tenant without billing suspension is not accidentally reenabled", () => {
  assert.equal(tenantAccessDecision({ ...hybrid, active: false }, "owner").allowed, false);
});
test("legacy tenant access behavior remains unchanged", () => {
  assert.equal(tenantAccessDecision({ billingMode: "revenue_share", active: false,
    revenueShareSuspended: true }, "owner").allowed, true);
  assert.equal(tenantAccessDecision({ billingMode: "subscription", subscriptionStatus: "suspended",
    active: false }, "owner").allowed, false);
});
test("hybrid report is routed, localized and uses backend preview, never payment mutations", () => {
  const app = fs.readFileSync("react-app/src/app/App.jsx", "utf8");
  const page = fs.readFileSync("react-app/src/pages/HybridBillingReportPage.jsx", "utf8");
  const home = fs.readFileSync("react-app/src/pages/HomePage.jsx", "utf8");
  const data = fs.readFileSync("react-app/src/data/hybridBillingReport.js", "utf8");
  assert.match(app, /path="\/reports\/hybrid-billing"/);
  assert.match(app, /hybridSuspended/);
  assert.match(home, /\{tenant \? \(/);
  assert.doesNotMatch(page, /tenant\?\.billingPolicyVersion !== "hybrid_v1"/);
  const preview = fs.readFileSync("functions/hybrid-billing-preview.js", "utf8");
  assert.match(preview, /const minMonth = tenantAnchorDate\(tenant\)/);
  assert.doesNotMatch(preview, /snap\.data\(\)\?\.billingPolicyVersion !== "hybrid_v1"/);
  assert.match(page, /getHybridBillingPreview\(month\)/);
  assert.match(page, /preview_only/);
  assert.doesNotMatch(page, /submitPayment|uploadBytes|confirmPayment/);
  assert.match(data, /getTenantHybridBillingPreview/);
  const dict = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json", "utf8"));
  for (const locale of ["th", "en", "my", "lo", "km"]) {
    assert.ok(dict[locale]?.hybrid_report?.preview_only);
  }
});
