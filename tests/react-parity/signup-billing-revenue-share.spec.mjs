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

test("public registration only offers Premium monthly/yearly and keeps legacy tenants unchanged", () => {
  const page = fs.readFileSync("react-app/src/pages/RegisterPage.jsx", "utf8");
  const backend = fs.readFileSync("functions/public-signup.js", "utf8");
  for (const token of [
    "businessType", '"restaurant_cafe"', '"retail"', '"both"',
    "loadPublicSubscriptionPricing", 'name="planCode"', 'value="monthly"', 'value="yearly"',
    'billingMode: "subscription"', "subscription_cycle",
  ]) assert.ok(page.includes(token), `RegisterPage missing ${token}`);
  assert.doesNotMatch(page, /name="billingMode"|billingModeRevenueShare|name="restaurantRevenueShareScope"|revenueShareMode|loadPublicHybridBillingSettings/);
  assert.match(backend, /request.data\?\.billingMode !== "subscription"/);
  for (const token of ["signupBillingSelectionValid", "normalizeSignupBilling", "businessUnitsFor",
    "signupBilling:", 'revenueShareEnabled: signupBilling.billingMode === "revenue_share"',
    'pending.billingPolicyVersion === "hybrid_v1"',
    'existingPendingSnap.data()?.billingPolicyVersion === "hybrid_v1"']) {
    assert.ok(backend.includes(token), `Public signup missing ${token}`);
  }
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

test("Super Admin Tenant modal shows only central Delivery settings, without per-store fields", () => {
  const source = fs.readFileSync("react-app/src/pages/AdminTenantsPage.jsx", "utf8");
  for (const token of [
    "loadAdminSubscriptionPricing", "centralDeliveryPricing", "centralPricingLoading",
    'data-central-delivery-settings="true"', 'id="revenueShareRate"',
    'id="revenueShareDeliveryThreshold"', 'id="openCentralDeliveryPricing"',
    'to="/platform/pricing"', "tenant.signupBilling",
  ]) assert.ok(source.includes(token), `AdminTenantsPage missing ${token}`);
  assert.doesNotMatch(source, /await updateTenantRevenueShare\(/);
  assert.doesNotMatch(source, /id="revenueShareEnabled"|id="saveRevenueShareButton"|setShareRate\(/);
  assert.match(source, /if \(!result\.exists\) throw new Error\("CENTRAL_DELIVERY_PRICING_MISSING"\)/);
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
  assert.match(ui, /data-central-delivery-settings="true"/);
  assert.doesNotMatch(ui, /id="revenueShareBusinessType"|id="revenueShareRestaurantScope"/);
  assert.doesNotMatch(backend.slice(backend.indexOf("exports.updateTenantRevenueShare")), /request.data\?\.businessType/);
});

test("Delivery commission begins AT the paid monthly threshold, with no retroactive previous days", () => {
  const { eligibleDeliveryShareDays } = require("../../functions/revenue-share-policy.js");
  const qualify = (rows, threshold = 10000) => eligibleDeliveryShareDays(rows, threshold);
  const days = qualify([
    { date: "2026-10-01", cents: 300000 }, // 3,000; no retroactive share
    { date: "2026-10-02", cents: 700000 }, // exactly 10,000: reaches 100% and qualifies
    { date: "2026-10-03", cents: 1 },      // after threshold continues to qualify
    { date: "2026-10-04", cents: 10000 },
    { date: "2026-11-01", cents: 1000000 }, // next month resets
    { date: "2026-11-02", cents: 1 },
  ]);
  assert.deepEqual([...days].sort(), ["2026-10-02", "2026-10-03", "2026-10-04", "2026-11-01", "2026-11-02"]);
  assert.deepEqual([...qualify([
    { date: "2026-10-02", cents: 500000 },
    { date: "2026-10-01", cents: 499999 },
    { date: "2026-10-02", cents: 2 },
  ])], ["2026-10-02"]);
  assert.deepEqual([...qualify([{ date: "2026-10-01", cents: 10000 }], 100)], ["2026-10-01"]);
  assert.deepEqual([...qualify([{ date: "2026-10-01", cents: 10001 }], 100)], ["2026-10-01"]);
  assert.throws(() => qualify([{ date: "bad", cents: 1000 }]));
  assert.throws(() => qualify([], -1));
});

test("only existing Revenue Share computation is adjusted; Delivery must be PAID and exclude shipping", () => {
  const source = fs.readFileSync("functions/revenue-share.js", "utf8");
  const form = fs.readFileSync("react-app/src/pages/AdminTenantsPage.jsx", "utf8");
  assert.match(source, /eligibleDeliveryShareDays/);
  assert.match(source, /String\(row\.paymentStatus \|\| ""\)\.toLowerCase\(\) !== "paid"/);
  assert.match(source, /row\.totalAmount \?\? row\.total/);
  assert.match(source, /Math\.max\(0, total - shipping\)/);
  assert.match(source, /row\.subtotalAmount != null && row\.subtotalAmount !== ""/);
  assert.match(source, /const deliveryShareBase = roundMoney\(shareDeliverySales\)/);
  assert.match(source, /deliveryShareBase \* setting\.deliveryShareRate \/ 100/);
  assert.match(source, /const revenueShare = roundMoney\(deliveryShareAmount \+ legacyShareAmount\)/);
  assert.match(source, /Per-Tenant commission settings are disabled/);
  assert.match(form, /id="revenueShareDeliveryThreshold"/);
  assert.match(form, /centralDeliveryPricing\.deliveryThreshold/);
  assert.doesNotMatch(form, /deliveryThreshold: Number\(shareDeliveryThreshold\)/);
  assert.doesNotMatch(source, /issueTenantHybridInvoices|hybridBillingInvoices|processHybridBillingDaily/);
});

test("Premium monthly Delivery commission reads centrally configured pricing and excludes POS/table", async () => {
  const { normalizePricing } = require("../../functions/subscription-pricing-core.js");
  const pricing = normalizePricing({ monthlyPrice: 590, deliveryThreshold: 10000, deliveryShareRate: 5 });
  assert.equal(pricing.deliveryThreshold, 10000);
  assert.equal(pricing.deliveryShareRate, 5);

  const orders = [
    { orderType: "delivery", paymentStatus: "paid", status: "delivered", subtotalAmount: 4000, totalAmount: 4050, deliveryFee: 50, paidAt: "2026-10-01T10:00:00+07:00" },
    { orderType: "delivery", paymentStatus: "paid", status: "delivered", subtotalAmount: 6000, totalAmount: 6050, deliveryFee: 50, paidAt: "2026-10-02T10:00:00+07:00" },
    { orderType: "delivery", paymentStatus: "paid", status: "delivered", deliveryProvider: "lalamove", lalamoveDispatchFee: 80, subtotalAmount: 500, totalAmount: 550, deliveryFee: 50, paidAt: "2026-10-03T10:00:00+07:00" },
    { orderType: "delivery", paymentStatus: "paid", status: "delivered", subtotalAmount: 1000, totalAmount: 1050, deliveryFee: 50, paidAt: "2026-10-04T10:00:00+07:00" },
    { orderType: "table", paymentStatus: "paid", status: "served", totalAmount: 2000, paidAt: "2026-10-04T10:00:00+07:00" },
    { orderType: "delivery", paymentStatus: "unpaid", status: "placed", totalAmount: 50000, deliveryFee: 0, createdAt: "2026-10-01T10:00:00+07:00" },
  ];
  const sales = [{ totalAmount: 3000, status: "completed", createdAt: "2026-10-04T11:00:00+07:00" }];
  const docs = rows => rows.map(data => ({ data: () => data }));
  const db = { collection: name => ({ doc: () => ({
    get: async () => ({ data: () => name === "users" ? { role: "super_admin", active: true } : {} }),
    collection: category => ({ get: async () => ({ docs: docs(category === "orders" ? orders : sales) }) }),
  }) }) };
  const policy = require("../../functions/revenue-share-policy.js");
  const dependencies = {
    "firebase-functions/v2/https": { onCall: (_options, fn) => fn, HttpsError: class extends Error { constructor(code, message) { super(message); this.code = code; } } },
    "firebase-functions/v2/scheduler": { onSchedule: (_options, fn) => fn },
    "firebase-admin/firestore": { getFirestore: () => db, FieldValue: {} },
    "firebase-admin/storage": { getStorage: () => ({}) },
    "./slip-verification": { inspectSlip: async () => ({}) },
    "./subscription-pricing-core": { loadPricing: async () => pricing },
    "./revenue-share-policy": policy,
  };
  const loaded = { exports: {} };
  const server = fs.readFileSync("functions/revenue-share.js", "utf8");
  new Function("module", "exports", "require", server +
    "\nmodule.exports.__setting = revenueSetting; module.exports.__summary = summaryForTenant;")(
    loaded, loaded.exports, key => {
      assert.ok(key in dependencies, `Unexpected dependency ${key}`);
      return dependencies[key];
    }
  );
  const tenant = { billingMode: "subscription", businessType: "both", revenueShareRate: 0 };
  const setting = loaded.exports.__setting(tenant, pricing);
  assert.equal(setting.premiumDeliveryShare, true);
  assert.equal(setting.legacyEnabled, false);
  assert.equal(setting.channels.includeRetail, false);
  assert.equal(setting.channels.restaurantScope, "delivery_only");
  assert.equal(setting.billingCycle, "monthly");
  const span = (day, next) => ({ start: new Date(day + "T00:00:00+07:00"), end: new Date(next + "T00:00:00+07:00") });
  const expected = [
    ["2026-10-01", "2026-10-02", 0],
    ["2026-10-02", "2026-10-03", 300],
    ["2026-10-03", "2026-10-04", 25],
    ["2026-10-04", "2026-10-05", 50],
    ["2026-10-01", "2026-11-01", 375],
  ];
  for (const [from, to, amount] of expected) {
    const actual = await loaded.exports.__summary("premium", span(from, to), setting);
    assert.equal(actual.revenueShare, amount, `Premium paid Delivery share: ${from}`);
    assert.equal(actual.platformAmountDue, amount, "Premium % excludes Lalamove delivery cost from commission due");
    assert.equal(actual.premiumDeliveryShareEnabled, true);
    assert.equal(actual.revenueShareEnabled, false, "Do not transform Premium into legacy revenue-share billing");
  }
  const retail = loaded.exports.__setting({ billingMode: "subscription", businessType: "retail" }, pricing);
  assert.equal(retail.enabled, false);
  const legacy = loaded.exports.__setting({
    billingMode: "revenue_share", businessType: "both",
    revenueShareRestaurantScope: "all", revenueShareRate: 10, revenueShareDeliveryThreshold: 20000,
  }, pricing);
  assert.equal(legacy.premiumDeliveryShare, false);
  assert.equal(legacy.rate, 10);
  assert.equal(legacy.deliveryThreshold, 10000);
  assert.equal(legacy.deliveryShareRate, 5);
  assert.equal(legacy.centralDeliveryShare, true);
  assert.equal(legacy.rate, 10, "Historical non-Delivery rate remains unchanged");
  const legacyMonth = await loaded.exports.__summary("legacy", span("2026-10-01", "2026-11-01"), legacy);
  assert.equal(legacyMonth.deliveryShareAmount, 375, "Legacy Delivery must also use 5% central at 100% threshold");
  assert.equal(legacyMonth.legacyShareAmount, 500, "Old POS/table charges remain under original historical contract");
  assert.equal(legacy.channels.includeRetail, true);
  assert.equal(loaded.exports.__setting(tenant).enabled, false, "Legacy suspension scheduler never activates Premium");
  await assert.rejects(
    loaded.exports.updateTenantRevenueShare({ auth: { uid: "super" }, data: {
      tenantId: "legacy", rate: 60, deliveryThreshold: 100, enabled: true, billingCycle: "monthly",
    } }),
    /Per-Tenant commission settings are disabled/,
    "A stale Super Admin client cannot overwrite central policy with Tenant-specific values",
  );
  const revised = loaded.exports.__setting(legacy ? {
    billingMode: "revenue_share", businessType: "both", revenueShareRate: 60,
    revenueShareDeliveryThreshold: 999999,
  } : {}, { ...pricing, deliveryThreshold: 12000, deliveryShareRate: 3 });
  assert.equal(revised.deliveryThreshold, 12000);
  assert.equal(revised.deliveryShareRate, 3);
  const revisedSummary = await loaded.exports.__summary("legacy", span("2026-10-01", "2026-11-01"), revised);
  assert.equal(revisedSummary.deliveryShareAmount, 0, "Central higher threshold wins regardless of stale Tenant config");
  assert.equal(revisedSummary.legacyShareAmount, 3000, "Legacy non-Delivery billing remains distinct");
  assert.match(server, /revenueSetting\(tenant, await loadPricing\(getFirestore\(\)\)\)/);
  assert.match(server, /revenueSetting\(tenant, premiumPricing\)/);
  assert.match(server, /const historicalSetting = revenueSetting\(tenant\)/);
  assert.match(server, /const setting = revenueSetting\(tenant, centralPricing \|\| await loadPricing\(db\)\)/);
  assert.match(server, /await reconcileTenant\(doc.id, centralPricing\)/);
  assert.doesNotMatch(server.slice(server.indexOf("async function reconcileTenant"), server.indexOf("async function tenantWalletReport")), /premiumDeliveryShare[^=]\s*=\s*true/);
});

test("Premium price editor exposes central paid-Delivery threshold and percentage", () => {
  const page = fs.readFileSync("react-app/src/pages/PlatformPricingPage.jsx", "utf8");
  const client = fs.readFileSync("react-app/src/data/subscriptionPricing.js", "utf8");
  const core = require("../../functions/subscription-pricing-core.js");
  assert.equal(core.DEFAULT_PRICING.deliveryThreshold, 10000);
  assert.equal(core.DEFAULT_PRICING.deliveryShareRate, 5);
  assert.match(page, /id="pricingDeliveryThreshold"/);
  assert.match(page, /id="pricingDeliveryShareRate"/);
  assert.match(client, /deliveryThreshold: 10000/);
  assert.match(client, /deliveryShareRate: 5/);
  assert.equal(core.calculatePricing({ monthlyPrice: 590, deliveryThreshold: 18000, deliveryShareRate: 3 }).config.deliveryThreshold, 18000);
  assert.equal(core.calculatePricing({ monthlyPrice: 590, deliveryThreshold: 18000, deliveryShareRate: 3 }).config.deliveryShareRate, 3);
});

test("Register custom business validation reuses central feedback UI and red invalid state", () => {
  const fsLocal = require("node:fs");
  const page = fsLocal.readFileSync("react-app/src/pages/RegisterPage.jsx", "utf8");
  const css = fsLocal.readFileSync("react-app/public/parity/css/register-page.css", "utf8");
  const shared = fsLocal.readFileSync("react-app/src/components/FormValidationUi.jsx", "utf8");
  assert.match(shared, /"#registerForm"/, "central HTML5 validation must not duplicate signup-specific checks");
  assert.match(shared, /const FEEDBACK_CLASS = "bootstrap-invalid-feedback"/);
  assert.match(page, /className="bootstrap-invalid-feedback show"/);
  assert.match(page, /"data-validation-state": invalid \? "invalid" : "valid"/);
  assert.match(page, /"aria-invalid": invalid/);
  assert.match(page, /"aria-describedby": invalid/);
  assert.match(page, /id=\{`\$\{name\}-validation`\}/);
  for (const name of [
    "ownerName", "phone", "email", "orderDeliveryShopName", "retailPosShopName",
    "slug", "secretA", "secretB", "termsAccepted", "businessType",
  ]) {
    assert.ok(page.includes(`fieldValidationProps("${name}")`),
      `missing signup feedback state for ${name}`);
  }
  assert.match(css, /#registerForm \.bootstrap-invalid-feedback\.show/);
  assert.match(css, /color: var\(--bs-form-invalid, #dc2626\) !important/);
  assert.match(css, /#registerForm :is\(input, select, textarea\)\[data-validation-state="invalid"\]/);
  assert.match(css, /white-space: normal/);
  assert.match(page, /validationMessage\("phone"\)|name === "phone"/);
});

test("Register actions use the Login green, full-width mobile grid and one-space centered icon spacing", () => {
  const { readFileSync } = require("node:fs");
  const registerCss = readFileSync("react-app/public/parity/css/register-page.css", "utf8");
  const loginCss = readFileSync("react-app/public/parity/css/login-page.css", "utf8");
  const jsx = readFileSync("react-app/src/pages/RegisterPage.jsx", "utf8");
  assert.match(loginCss, /\.btn-pay\s*\{\s*background:\s*#159447;/);
  const actionFix = registerCss.slice(registerCss.indexOf("/* Register action alignment and mobile width parity"));
  assert.ok(actionFix, "registration action style missing");
  assert.match(actionFix, /\.register-page \.register-header > \.btn\s*\{\s*background:\s*#159447;/);
  assert.match(actionFix, /\.register-page \.register-header > \.btn,[\s\S]*?\.register-page \.register-actions > \.btn\s*\{[\s\S]*?gap: 4px !important;/);
  assert.match(actionFix, /\.register-page \.register-header > \.btn > \.bi,[\s\S]*?\.register-page \.register-actions > \.btn > \.bi\s*\{[\s\S]*?align-items: center;[\s\S]*?justify-content: center;/);
  assert.match(actionFix, /@media \(max-width: 760px\)/);
  assert.match(actionFix, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(actionFix, /justify-content: stretch;/);
  assert.match(actionFix, /\.register-page \.register-actions > \.btn\s*\{[\s\S]*?width: 100%;/);
  assert.match(jsx, /className="register-actions"/);
  assert.match(jsx, /id="submitRegister"/);
  assert.match(jsx, /className="btn" to="\/login"/);
  assert.match(jsx, /className="btn btn-sm" to="\/"/);
});
