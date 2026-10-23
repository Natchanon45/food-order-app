"use strict";

// Canonical calendar-month anniversary periods in Asia/Bangkok.
// 31 Jan -> 28 Feb (or 29 Feb) -> 31 Mar: NEVER derive the next
// anniversary from a prior clamped date, or the cycle would drift.
function validDateKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ""))) throw new RangeError("Invalid billing anniversary date");
  const date = new Date(key + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) {
    throw new RangeError("Invalid billing anniversary date");
  }
  return key;
}

function asDate(value) {
  if (!value) return null;
  const parsed = typeof value.toDate === "function" ? value.toDate()
    : value instanceof Date ? value
    : typeof value === "object" && Number.isFinite(value.seconds)
      ? new Date(value.seconds * 1000) : new Date(value);
  return parsed instanceof Date && Number.isFinite(parsed.getTime()) ? parsed : null;
}

function bangkokDateKey(date) {
  const parsed = asDate(date);
  if (!parsed) throw new RangeError("Invalid billing instant");
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(parsed);
  const o = Object.fromEntries(p.map(item => [item.type, item.value]));
  return validDateKey(o.year + "-" + o.month + "-" + o.day);
}

function tenantAnchorDate(tenant = {}) {
  // An explicit billing anchor takes precedence over the activation timestamp.
  // Do not use signup request date or last payment date: neither is activation.
  for (const value of [
    tenant.billingCycleAnchorAt, tenant.revenueShareCycleAnchorAt,
    tenant.hybridBillingActivatedAt, tenant.trialStartsAt, tenant.activatedAt,
    tenant.createdAt,
  ]) {
    const date = asDate(value);
    if (date) return bangkokDateKey(date);
  }
  // Older tenants without a trusted activation date retain calendar months.
  return null;
}

function offsetMonth(month, delta) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ""))) throw new RangeError("Invalid billing month");
  const [year, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
function anniversaryDate(anchor, month) {
  const original = validDateKey(anchor);
  const [year, m] = month.split("-").map(Number);
  if (!Number.isSafeInteger(year) || !(m >= 1 && m <= 12)) throw new RangeError("Invalid billing month");
  const maxDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const day = Math.min(Number(original.slice(8, 10)), maxDay);
  return month + "-" + String(day).padStart(2, "0");
}
function atBangkokStart(day) {
  return new Date(validDateKey(day) + "T00:00:00+07:00");
}
function cycleFromMonth(anchor, month) {
  const anchorDate = validDateKey(anchor);
  const startDate = anniversaryDate(anchorDate, month);
  if (startDate < anchorDate) throw new RangeError("Billing cycle precedes activation");
  const endExclusiveDate = anniversaryDate(anchorDate, offsetMonth(month, 1));
  const next = atBangkokStart(endExclusiveDate);
  return {
    month, startDate, endExclusiveDate,
    endDate: new Date(Date.parse(endExclusiveDate + "T00:00:00Z") - 86400000).toISOString().slice(0, 10),
    start: atBangkokStart(startDate), end: next,
    label: startDate + " – " + new Date(Date.parse(endExclusiveDate + "T00:00:00Z") - 86400000).toISOString().slice(0, 10),
  };
}
function cycleForDate(anchor, day) {
  const anchorDate = validDateKey(anchor);
  const selected = validDateKey(day);
  if (selected < anchorDate) return null;
  const calendarMonth = selected.slice(0, 7);
  const candidate = anniversaryDate(anchorDate, calendarMonth);
  const startMonth = selected < candidate ? offsetMonth(calendarMonth, -1) : calendarMonth;
  return cycleFromMonth(anchorDate, startMonth);
}
function previousCompletedCycle(anchor, today) {
  const current = cycleForDate(anchor, today);
  if (!current) return null;
  const previousMonth = offsetMonth(current.month, -1);
  if (anniversaryDate(anchor, previousMonth) < validDateKey(anchor)) return null;
  return cycleFromMonth(anchor, previousMonth);
}

module.exports = {
  validDateKey, bangkokDateKey, tenantAnchorDate, offsetMonth, anniversaryDate,
  cycleFromMonth, cycleForDate, previousCompletedCycle, atBangkokStart,
};
