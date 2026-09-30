export const DEFAULT_GRACE_DAYS = 3;

export function tenantDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date?.getTime?.()) ? null : date;
  }
  if (typeof value === "object" && Number.isFinite(Number(value.seconds))) {
    return new Date(Number(value.seconds) * 1000);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function revenueShareEnabled(tenant = {}) {
  return tenant.revenueShareEnabled === true || tenant.billingMode === "revenue_share";
}

export function revenueShareSuspended(tenant = {}) {
  return revenueShareEnabled(tenant) && tenant.revenueShareSuspended === true;
}

export function effectiveSubscriptionStatus(tenant = {}, now = new Date()) {
  if (revenueShareEnabled(tenant)) {
    return tenant.revenueShareSuspended === true ? "revenue_share_suspended" : "revenue_share_active";
  }

  const stored = String(tenant.subscriptionStatus || "active").trim().toLowerCase();
  if (stored === "suspended" || (tenant.active === false && String(tenant.suspensionReason || "").trim())) {
    return "suspended";
  }
  if (stored === "expired") return "expired";

  const expiresAt = tenantDate(tenant.subscriptionExpiresAt);
  if (!expiresAt) return stored || "active";

  if (now.getTime() <= expiresAt.getTime()) {
    return stored === "trialing" ? "trialing" : "active";
  }

  const graceDays = Math.max(0, Math.min(30, Number(tenant.gracePeriodDays ?? DEFAULT_GRACE_DAYS) || 0));
  const graceEndsAt = new Date(expiresAt.getTime() + graceDays * 86400000);
  return now.getTime() <= graceEndsAt.getTime() ? "grace" : "expired";
}

export function tenantAccessDecision(tenant = {}, role = "", now = new Date()) {
  if (revenueShareEnabled(tenant)) {
    if (tenant.revenueShareSuspended === true) {
      const allowed = ["owner", "admin"].includes(String(role || ""));
      return {
        allowed,
        status: "revenue_share_suspended",
        code: allowed ? "" : "TENANT_INACTIVE",
      };
    }
    return { allowed: true, status: "revenue_share_active", code: "" };
  }

  const status = effectiveSubscriptionStatus(tenant, now);
  if (status === "expired") {
    return { allowed: false, status, code: "TENANT_SUBSCRIPTION_EXPIRED" };
  }
  if (status === "suspended") {
    return { allowed: false, status, code: "TENANT_SUSPENDED" };
  }
  if (tenant.active === false) {
    return { allowed: false, status: "inactive", code: "TENANT_INACTIVE" };
  }
  if (!["active", "grace", "trialing"].includes(status)) {
    return { allowed: false, status, code: "TENANT_INACTIVE" };
  }
  return { allowed: true, status, code: "" };
}

export function tenantAccessError(decision) {
  const code = String(decision?.code || "TENANT_INACTIVE");
  const error = new Error(code);
  error.code = code;
  error.tenantStatus = String(decision?.status || "");
  return error;
}
