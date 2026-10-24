import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sub = fs.readFileSync("functions/subscription-admin.js","utf8");
const shell = fs.readFileSync("react-app/src/app/App.jsx","utf8");
const access = fs.readFileSync("react-app/src/auth/tenantAccess.js","utf8");

test("Premium Delivery suspension routes owner/admin to the payment report", () => {
  assert.match(shell, /tenant\?\.revenueShareSuspended === true/);
  assert.match(shell, /tenant\?\.billingPolicyVersion !== "hybrid_v1"/);
  assert.match(shell, /to="\/reports\/revenue-share"/);
  assert.match(shell, /const ownerAdmin = \["owner", "admin"\]/);
  assert.match(access, /revenueShareEnabled\(tenant\) \|\| revenueShareSuspended\(tenant\)/);
});

test("Subscription scheduler and subscription edits do not unsuspend unpaid Premium shops", () => {
  assert.match(sub, /if \(revenueShareEnabled\(tenant\) \|\| tenant\.revenueShareSuspended === true\) continue/);
  assert.match(sub, /if \(tenant\.revenueShareSuspended === true\) active = false/);
  assert.match(sub, /every day 00:15/);
  const callable = sub.slice(sub.indexOf("exports.updateTenantSubscription"));
  assert.match(callable, /subscriptionUpdatedBy:/);
});
