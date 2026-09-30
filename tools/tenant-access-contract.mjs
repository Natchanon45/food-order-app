import {
  effectiveSubscriptionStatus,
  tenantAccessDecision,
} from "../react-app/src/auth/tenantAccess.js";

const assert = (condition, message) => {
  if (!condition) {
    console.error(`Tenant access contract: FAIL — ${message}`);
    process.exit(1);
  }
};

const now = new Date("2026-09-29T08:40:00+07:00");
const day = 86400000;
const date = offsetDays => new Date(now.getTime() + offsetDays * day);

assert(
  effectiveSubscriptionStatus({
    active: true,
    subscriptionStatus: "active",
    subscriptionExpiresAt: date(1),
    gracePeriodDays: 3,
  }, now) === "active",
  "future subscription must remain active",
);

assert(
  effectiveSubscriptionStatus({
    active: true,
    subscriptionStatus: "active",
    subscriptionExpiresAt: date(-1),
    gracePeriodDays: 3,
  }, now) === "grace",
  "expired date inside grace period must resolve to grace",
);

const expired = tenantAccessDecision({
  active: true,
  subscriptionStatus: "active",
  subscriptionExpiresAt: date(-4),
  gracePeriodDays: 3,
}, "owner", now);
assert(!expired.allowed && expired.code === "TENANT_SUBSCRIPTION_EXPIRED", "past grace period must deny as expired");

const suspended = tenantAccessDecision({
  active: false,
  subscriptionStatus: "suspended",
  suspensionReason: "manual",
}, "owner", now);
assert(!suspended.allowed && suspended.code === "TENANT_SUSPENDED", "manual suspension must deny as suspended");

const inactive = tenantAccessDecision({
  active: false,
  subscriptionStatus: "active",
  subscriptionExpiresAt: date(10),
  suspensionReason: "",
}, "owner", now);
assert(!inactive.allowed && inactive.code === "TENANT_INACTIVE", "physically inactive tenant must be denied");

const shareOwner = tenantAccessDecision({
  active: false,
  billingMode: "revenue_share",
  revenueShareEnabled: true,
  revenueShareSuspended: true,
}, "owner", now);
assert(shareOwner.allowed && shareOwner.status === "revenue_share_suspended", "revenue-share suspended owner must retain report access");

const shareCashier = tenantAccessDecision({
  active: false,
  billingMode: "revenue_share",
  revenueShareEnabled: true,
  revenueShareSuspended: true,
}, "cashier", now);
assert(!shareCashier.allowed && shareCashier.code === "TENANT_INACTIVE", "revenue-share suspended cashier must be blocked");

console.log("Tenant access contract: PASS");
console.log("active/grace/expired/suspended/revenue-share suspension semantics verified");
