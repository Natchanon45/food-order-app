// Display-only fallback for a live Revenue Share callable deployed before the
// anniversary fields existed. Do not use this to determine collectible debt.
// TenantProvider supplies the Firestore tenant document (not browser storage).
function validDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function formatBillingCycleRange(startDate, endDate) {
  if (!validDateKey(startDate) || !validDateKey(endDate) || endDate < startDate) return "";
  const display = key => key.slice(8, 10) + "/" + key.slice(5, 7) + "/" + key.slice(0, 4);
  return display(startDate) + " - " + display(endDate);
}

function asDate(value) {
  if (!value) return null;
  let parsed;
  try {
    parsed = typeof value.toDate === "function" ? value.toDate()
      : value instanceof Date ? value
        : typeof value === "object" && Number.isFinite(value.seconds)
          ? new Date(value.seconds * 1000) : new Date(value);
  } catch {
    return null;
  }
  return parsed instanceof Date && Number.isFinite(parsed.getTime()) ? parsed : null;
}

function bangkokDateKey(value) {
  const date = asDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const key = fields.year + "-" + fields.month + "-" + fields.day;
  return validDateKey(key) ? key : "";
}

function tenantAnchorDate(tenant) {
  // Mirror functions/billing-anniversary.js, including source priority.
  if (!tenant || typeof tenant !== "object") return "";
  for (const value of [
    tenant.billingCycleAnchorAt, tenant.revenueShareCycleAnchorAt,
    tenant.hybridBillingActivatedAt, tenant.trialStartsAt, tenant.activatedAt,
    tenant.createdAt,
  ]) {
    const key = bangkokDateKey(value);
    if (key) return key;
  }
  return "";
}

function anniversaryDate(anchorDay, monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return monthKey + "-" + String(Math.min(anchorDay, lastDay)).padStart(2, "0");
}

function offsetMonth(monthKey, offset) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function billingCycleFromTenant(tenant, now = new Date()) {
  const anchor = tenantAnchorDate(tenant);
  const today = bangkokDateKey(now);
  if (!anchor || !today || today < anchor) return null;

  const calendarMonth = today.slice(0, 7);
  const anchorDay = Number(anchor.slice(8, 10));
  const currentAnniversary = anniversaryDate(anchorDay, calendarMonth);
  const startMonth = today < currentAnniversary ? offsetMonth(calendarMonth, -1) : calendarMonth;
  const startDate = anniversaryDate(anchorDay, startMonth);
  if (startDate < anchor) return null;

  const endExclusive = anniversaryDate(anchorDay, offsetMonth(startMonth, 1));
  const endDate = new Date(Date.parse(endExclusive + "T00:00:00Z") - 86400000)
    .toISOString().slice(0, 10);
  return { startDate, endDate };
}

export function resolveBillingCycleRange(summary, tenant, now = new Date()) {
  // Prefer server-computed anniversary values whenever both are valid.
  const fromServer = formatBillingCycleRange(
    summary?.monthlyDeliveryStartDate, summary?.monthlyDeliveryEndDate,
  );
  if (fromServer) return fromServer;
  const cycle = billingCycleFromTenant(tenant, now);
  return cycle ? formatBillingCycleRange(cycle.startDate, cycle.endDate) : "";
}
