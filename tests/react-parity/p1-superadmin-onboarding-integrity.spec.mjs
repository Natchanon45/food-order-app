import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { onboardingDates, monthStartAfter } = require("../../functions/tenant-onboarding-policy.js");
const src = path => readFileSync(path, "utf8");

test("monthly trial follows Bangkok activation anniversary and does not give old stores a new trial", () => {
  const first = new Date("2026-10-18T03:30:00.000Z");
  const result = onboardingDates(first, "monthly");
  assert.equal(result.trialStartsAt.toISOString(), first.toISOString());
  assert.equal(result.trialEndsAt.toISOString(), "2026-11-17T16:59:59.999Z");
  assert.equal(result.subscriptionExpiresAt.toISOString(), "2026-11-17T16:59:59.999Z");
  const server = src("functions/tenant-provision.js");
  assert.match(server, /onboardingRequired: false, firstActivatedAt: started/);
  assert.match(server, /planCode: input.planCode, onboardingRequired: false/);
  const renewal = src("functions/subscription-admin.js");
  assert.match(renewal, /tenant.onboardingRequired === true/);
  assert.match(renewal, /SUBSCRIPTION_ORIGINAL_ENROLLMENT_REQUIRED/);
});

test("yearly plan has one free month then twelve membership months", () => {
  const started = new Date("2026-10-31T07:00:00Z");
  const period = onboardingDates(started, "yearly");
  assert.equal(period.trialEndsAt.toISOString(), "2026-11-29T16:59:59.999Z");
  assert.equal(period.subscriptionExpiresAt.toISOString(), "2027-11-29T16:59:59.999Z");
  assert.equal(monthStartAfter(started, 1).toISOString(), "2026-11-29T17:00:00.000Z");
  assert.throws(() => onboardingDates(started, "invalid"), /INVALID_PLAN_CODE/);
  assert.throws(() => onboardingDates(new Date("invalid"), "monthly"), /INVALID_ACTIVATION_DATE/);
});

test("new tenant is not billed by subscription job before first owner is created", () => {
  const server = src("functions/subscription-admin.js");
  assert.match(server, /tenant.onboardingRequired === true\) return/);
  assert.match(server, /tenant.onboardingRequired === true\) return false/);
  assert.match(server, /SUBSCRIPTION_ORIGINAL_ENROLLMENT_REQUIRED/);
  const access = src("react-app/src/auth/tenantAccess.js");
  assert.match(access, /stored === "trialing" && trialEndsAt && now <= trialEndsAt/);
});

test("staff scope is checked server-side and stale tenant data is rejected in UI", () => {
  const server = src("functions/staff-admin.js");
  assert.match(server, /async function authorized\(db,auth,expectedTenantId,nativeAuth\)/);
  assert.match(server, /profile.tenantId!==expectedTenantId/);
  assert.match(server, /await reservationActor\(tx,db,caller.uid,tenantId\)/);
  assert.match(server, /user.data\(\)\?\.tenantId!==input.expectedTenantId/);
  const page = src("react-app/src/pages/AdminUsersPage.jsx");
  assert.match(page, /activeTenantIdRef.current !== expectedTenantId/);
  assert.match(page, /requestId !== loadRequestRef.current/);
  assert.match(page, /readyTenantId !== tenantState.tenant/);
  assert.match(page, /data-staff-search/);
  assert.match(page, /data-staff-filter/);
});

test("new Platform Owner UI requires canonical reread and retains uncertain write lock", () => {
  const page = src("react-app/src/pages/PlatformOwnersPage.jsx");
  assert.match(page, /const nextTenants = await listTenants\(\)/);
  assert.match(page, /canonicalOwnerMatches\(nextTenants,status\)/);
  assert.match(page, /OWNER_OPERATION_NOT_CONFIRMED/);
  assert.match(page, /getPlatformTenantOwnerOperation/);
  assert.match(page, /id="ownerBillingPlan"/);
  assert.match(page, /disabled=\{saving \|\| \(selected != null && isOwnerLocked\(selected.id\)\)\}/);
});

test("Telegram and pricing controls are server-owned and hide secrets", () => {
  const token = src("functions/platform-telegram.js");
  assert.match(token, /defineSecret\("PENGUIN_TELEGRAM_ENCRYPTION_KEY"\)/);
  assert.match(token, /createCipheriv\("aes-256-gcm"/);
  assert.match(token, /await assertSuperAdmin\(request.auth\)/);
  assert.doesNotMatch(token, /return \{[^}]+botToken:/);
  const pricing = src("functions/subscription-pricing.js");
  assert.match(pricing, /Monthly Slip2Go quota must be a whole number/);
  const form = src("react-app/src/pages/PlatformPricingPage.jsx");
  assert.doesNotMatch(form, /id="pricingMonthlySlipQuota"/);
  assert.match(form, /monthlySlipQuota: current.monthlySlipQuota/);
  assert.match(form, /saveUnconfirmed/);
  assert.match(form, /storageReady/);
});
