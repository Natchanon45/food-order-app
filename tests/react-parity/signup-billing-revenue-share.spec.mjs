import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

test("signup billing policy normalizes supported business and billing choices", () => {
  const policy = require("../../functions/revenue-share-policy.js");
  assert.deepEqual(policy.normalizeSignupBilling({
    billingMode: "subscription",
    businessType: "restaurant_cafe",
    planCode: "yearly",
  }), {
    billingMode: "subscription",
    businessType: "restaurant_cafe",
    planCode: "yearly",
    restaurantRevenueShareScope: "all",
  });
  assert.deepEqual(policy.normalizeSignupBilling({
    billingMode: "revenue_share",
    businessType: "both",
    restaurantRevenueShareScope: "delivery_only",
  }), {
    billingMode: "revenue_share",
    businessType: "both",
    planCode: "monthly",
    restaurantRevenueShareScope: "delivery_only",
  });
  assert.deepEqual(policy.businessUnitsFor("restaurant_cafe"), ["order_delivery"]);
  assert.deepEqual(policy.businessUnitsFor("retail"), ["retail_pos"]);
  assert.deepEqual(policy.businessUnitsFor("both"), ["order_delivery", "retail_pos"]);
});

test("signup billing selection requires an explicit business and restaurant scope when applicable", () => {
  const policy = require("../../functions/revenue-share-policy.js");
  assert.equal(policy.signupBillingSelectionValid({ billingMode: "subscription", businessType: "restaurant_cafe", planCode: "monthly" }), true);
  assert.equal(policy.signupBillingSelectionValid({ billingMode: "revenue_share", businessType: "retail" }), true);
  assert.equal(policy.signupBillingSelectionValid({ billingMode: "revenue_share", businessType: "restaurant_cafe", restaurantRevenueShareScope: "delivery_only" }), true);
  assert.equal(policy.signupBillingSelectionValid({ billingMode: "revenue_share", businessType: "restaurant_cafe", restaurantRevenueShareScope: "" }), false);
  assert.equal(policy.signupBillingSelectionValid({ billingMode: "subscription", businessType: "" }), false);
});

test("restaurant revenue-share scope includes the correct restaurant channels", () => {
  const policy = require("../../functions/revenue-share-policy.js");
  assert.equal(policy.restaurantOrderEligible("delivery", "delivery_only"), true);
  assert.equal(policy.restaurantOrderEligible("table", "delivery_only"), false);
  assert.equal(policy.restaurantOrderEligible("walkin", "delivery_only"), false);
  assert.equal(policy.restaurantOrderEligible("takeaway", "delivery_only"), false);

  assert.equal(policy.restaurantOrderEligible("delivery", "storefront_only"), false);
  assert.equal(policy.restaurantOrderEligible("table", "storefront_only"), true);
  assert.equal(policy.restaurantOrderEligible("walkin", "storefront_only"), true);
  assert.equal(policy.restaurantOrderEligible("takeaway", "storefront_only"), true);

  for (const type of ["delivery", "table", "walkin", "takeaway"]) {
    assert.equal(policy.restaurantOrderEligible(type, "all"), true);
  }
});

test("revenue-share business policy selects restaurant and retail sales independently", () => {
  const policy = require("../../functions/revenue-share-policy.js");
  assert.deepEqual(policy.revenueShareChannels({
    billingMode: "revenue_share",
    revenueShareBusinessType: "restaurant_cafe",
    revenueShareRestaurantScope: "storefront_only",
  }), {
    enabled: true,
    includeRestaurant: true,
    includeRetail: false,
    restaurantScope: "storefront_only",
  });
  assert.deepEqual(policy.revenueShareChannels({
    billingMode: "revenue_share",
    revenueShareBusinessType: "retail",
  }), {
    enabled: true,
    includeRestaurant: false,
    includeRetail: true,
    restaurantScope: "all",
  });
  assert.deepEqual(policy.revenueShareChannels({
    billingMode: "revenue_share",
    revenueShareBusinessType: "both",
    revenueShareRestaurantScope: "delivery_only",
  }), {
    enabled: true,
    includeRestaurant: true,
    includeRetail: false,
    restaurantScope: "delivery_only",
  });
});

test("RegisterPage exposes billing model, business type, conditional restaurant scope, and monthly/yearly subscription choice", () => {
  const source = fs.readFileSync("react-app/src/pages/RegisterPage.jsx", "utf8");
  for (const token of [
    'billingMode',
    'businessType',
    'restaurantRevenueShareScope',
    'planCode',
    '"subscription"',
    '"revenue_share"',
    '"restaurant_cafe"',
    '"retail"',
    '"both"',
    '"delivery_only"',
    '"storefront_only"',
    'regularConfigured',
  ]) assert.ok(source.includes(token), `RegisterPage missing ${token}`);
  assert.ok(
    source.indexOf('t("auth.register.business.title")') < source.indexOf('t("auth.register.billing.title")'),
    "Business selection must appear before billing-model selection",
  );
});

test("public signup persists customer billing choices to pending signup and tenant", () => {
  const source = fs.readFileSync("functions/public-signup.js", "utf8");
  for (const token of [
    "normalizeSignupBilling",
    "businessUnitsFor",
    "billingMode",
    "revenueShareBusinessType",
    "revenueShareRestaurantScope",
    "revenueShareEnabled",
    "planCode",
    "signupBilling:",
    "signupBillingSelectionValid",
  ]) assert.ok(source.includes(token), `public-signup missing ${token}`);
});

test("revenue share calculation filters restaurant/POS share base by tenant policy", () => {
  const source = fs.readFileSync("functions/revenue-share.js", "utf8");
  for (const token of [
    "revenueShareChannels",
    "restaurantOrderEligible",
    "includeRestaurant",
    "includeRetail",
    "restaurantScope",
  ]) assert.ok(source.includes(token), `revenue-share missing ${token}`);
});

test("Super Admin tenant management shows and edits signup business/share scope", () => {
  const source = fs.readFileSync("react-app/src/pages/AdminTenantsPage.jsx", "utf8");
  for (const token of [
    "shareBusinessType",
    "shareRestaurantScope",
    "revenueShareBusinessType",
    "revenueShareRestaurantScope",
    "signup_billing",
    "tenant.signupBilling",
  ]) assert.ok(source.includes(token), `AdminTenantsPage missing ${token}`);
});

test("subscription initializer/backfill/scheduler preserve signup cycle/trial and skip revenue-share tenants", () => {
  const source = fs.readFileSync("functions/subscription-admin.js", "utf8");
  assert.ok(source.includes("if (tenant.subscriptionExpiresAt || revenueShareEnabled(tenant)) return;"));
  assert.ok(source.includes('tenant.planCode === "yearly" ? "yearly" : "monthly"'));
  assert.ok(source.includes("tenant.trialEndsAt"));
  assert.ok(source.includes('tenant.subscriptionStatus === "trialing"'));
  assert.equal((source.match(/defaultPatch\(new Date\(\), tenant\)/g) || []).length, 3);
});

test("repeat activation preserves the original subscription trial end", () => {
  const source = fs.readFileSync("functions/public-signup.js", "utf8");
  assert.ok(source.includes("pending.trialEndsAt"));
  assert.ok(source.includes("trialEndsAt: subscriptionTrial ? trialEndsAt : null"));
});

test("new signup and Super Admin billing copy is localized in every supported locale", () => {
  const dictionary = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json", "utf8"));
  for (const locale of ["th", "en", "my", "lo", "km"]) {
    assert.ok(dictionary?.[locale]?.auth?.register?.billing?.title, `${locale} missing register.billing`);
    assert.ok(dictionary?.[locale]?.auth?.register?.business?.title, `${locale} missing register.business`);
    assert.ok(dictionary?.[locale]?.auth?.register?.revenue_scope?.title, `${locale} missing register.revenue_scope`);
    assert.ok(dictionary?.[locale]?.admin_tenants?.signup_billing?.title, `${locale} missing admin_tenants.signup_billing`);
    assert.ok(dictionary?.[locale]?.admin_tenants?.share?.business_type, `${locale} missing share.business_type`);
  }
});


test("Super Admin can change master business without rewriting signup and share choices", () => {
  const ui = fs.readFileSync("react-app/src/pages/AdminTenantsPage.jsx", "utf8");
  const backend = fs.readFileSync("functions/tenant-admin.js", "utf8");
  const edit = backend.slice(backend.indexOf("exports.updateTenant ="), backend.indexOf("exports.deleteTenant ="));
  assert.match(ui, /id="tenantMasterBusinessType"/);
  assert.match(ui, /businessType: form.businessType/);
  assert.match(ui, /tenant-signup-business-overview/);
  assert.match(edit, /BUSINESS_TYPES\.has\(requestedBusinessType\)/);
  assert.match(edit, /businessUnitsFor\(requestedBusinessType\)/);
  assert.doesNotMatch(edit, /signupBilling\s*:/);
  assert.doesNotMatch(edit, /revenueShareBusinessType\s*:/);
});

test("master business and selected scope control Retail POS commission eligibility", () => {
  const policy = require("../../functions/revenue-share-policy.js");
  const channels = (businessType, restaurantScope) => policy.revenueShareChannels({
    businessType, revenueShareBusinessType: "both", revenueShareEnabled: true,
    revenueShareRestaurantScope: restaurantScope,
  });
  assert.equal(channels("restaurant_cafe", "all").includeRetail, false);
  assert.equal(channels("retail", "all").includeRetail, true);
  assert.equal(channels("both", "delivery_only").includeRetail, false);
  assert.equal(channels("both", "storefront_only").includeRetail, true);
  assert.equal(channels("both", "all").includeRetail, true);
  assert.equal(channels("both", "delivery_only").includeRestaurant, true);
  const ui = fs.readFileSync("react-app/src/pages/AdminTenantsPage.jsx", "utf8");
  const backend = fs.readFileSync("functions/revenue-share.js", "utf8");
  assert.match(ui, /id="revenueShareBusinessType" readOnly/);
  assert.doesNotMatch(backend.slice(backend.indexOf("exports.updateTenantRevenueShare")), /request.data\?\.businessType/);
});
