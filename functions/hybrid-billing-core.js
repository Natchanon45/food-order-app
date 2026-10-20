"use strict";

// Pure, side-effect-free calculator. All periods follow the Bangkok signup day,
// not calendar-month boundaries. Only server-validated paid Delivery merchandise.
const DEFAULT_SETTINGS = Object.freeze({
  monthlyFee: 590,
  deliveryThreshold: 10000,
  deliveryShareRate: 5,
  monthlySlipQuota: 100,
  timezone: "Asia/Bangkok",
  policyVersion: "hybrid_v1",
});

function validateMoney(value, label, minimum = 0) {
  const number = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(number)
    || number < minimum || number > 1000000000 || Math.abs(number * 100 - Math.round(number * 100)) > 1e-6) {
    throw new RangeError(`Invalid ${label}`);
  }
  return Math.round(number * 100) / 100;
}
function normalizeSettings(input = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...input };
  const monthlyFee = validateMoney(settings.monthlyFee, "monthlyFee");
  const deliveryThreshold = validateMoney(settings.deliveryThreshold, "deliveryThreshold", 0.01);
  const deliveryShareRate = Number(settings.deliveryShareRate);
  const monthlySlipQuota = Number(settings.monthlySlipQuota);
  if (!Number.isFinite(deliveryShareRate) || deliveryShareRate < 0 || deliveryShareRate > 100) {
    throw new RangeError("Invalid deliveryShareRate");
  }
  if (!Number.isSafeInteger(monthlySlipQuota) || monthlySlipQuota < 0 || monthlySlipQuota > 1000000) {
    throw new RangeError("Invalid monthlySlipQuota");
  }
  return Object.freeze({ monthlyFee, deliveryThreshold, deliveryShareRate, monthlySlipQuota,
    timezone: "Asia/Bangkok", policyVersion: "hybrid_v1" });
}
function dateKey(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(value.getTime())) throw new RangeError("Invalid timestamp");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok",
    year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${m.year}-${m.month}-${m.day}`;
}
function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) throw new RangeError("Invalid billing date");
  const d = new Date(`${s}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new RangeError("Invalid calendar date");
  return s;
}
function nextDate(s) {
  return new Date(Date.parse(validDate(s) + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
}
function prevDate(s) {
  return new Date(Date.parse(validDate(s) + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
}
function roundSatang(baht) { return Math.round((baht + Number.EPSILON) * 100) / 100; }

// The original signup day remains the anchor: Jan 31 -> Feb 28 -> Mar 31,
// never Feb 28 -> Mar 28. End dates are EXCLUSIVE at 00:00 Asia/Bangkok.
function anchorAtMonth(signupDate, monthsAfter) {
  const [year, month, day] = validDate(signupDate).split("-").map(Number);
  if (!Number.isSafeInteger(monthsAfter) || monthsAfter < 0 || monthsAfter > 1200) {
    throw new RangeError("Invalid billing cycle offset");
  }
  const yearMonth = new Date(Date.UTC(year, month - 1 + monthsAfter, 1));
  const y = yearMonth.getUTCFullYear(), m = yearMonth.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}
function billingCycle(signupDate, onDate) {
  validDate(signupDate);
  validDate(onDate);
  if (onDate < signupDate) throw new RangeError("Billing date precedes signup");
  const [y, m] = onDate.split("-").map(Number);
  const [sy, sm] = signupDate.split("-").map(Number);
  let offset = (y - sy) * 12 + m - sm;
  if (anchorAtMonth(signupDate, offset) > onDate) offset--;
  const startDate = anchorAtMonth(signupDate, offset);
  const endDate = anchorAtMonth(signupDate, offset + 1);
  return Object.freeze({
    id: startDate, startDate, endDate, lastDate: prevDate(endDate),
    firstCycle: offset === 0, index: offset,
  });
}
function billingCycleById(signupDate, cycleId) {
  validDate(cycleId);
  const cycle = billingCycle(signupDate, cycleId);
  if (cycle.id !== cycleId) throw new RangeError("Not a billing cycle start date");
  return cycle;
}
function cycleWindow(cycle) {
  validDate(cycle.startDate);
  validDate(cycle.endDate);
  return {
    start: new Date(`${cycle.startDate}T00:00:00+07:00`),
    end: new Date(`${cycle.endDate}T00:00:00+07:00`),
  };
}
function calculateCycle({ signupDate, cycleId, dailyDeliverySales = [], settings = {} }) {
  const cycle = billingCycleById(signupDate, cycleId);
  if (!Array.isArray(dailyDeliverySales)) throw new TypeError("Invalid dailyDeliverySales");
  const config = normalizeSettings(settings);
  const sales = new Map();
  for (const item of dailyDeliverySales) {
    const day = validDate(item?.date);
    if (day < cycle.startDate || day >= cycle.endDate) throw new RangeError("Daily sale outside cycle");
    const amount = validateMoney(item?.amount, "dailyDeliverySales.amount");
    sales.set(day, (sales.get(day) || 0) + Math.round(amount * 100));
  }
  let cumulativeCents = 0, triggerDate = null, totalShareCents = 0;
  const thresholdCents = Math.round(config.deliveryThreshold * 100), invoices = [], days = [];
  for (const [date, cents] of [...sales.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    cumulativeCents += cents;
    let baseCents = 0, kind = null;
    if (!triggerDate && cumulativeCents >= thresholdCents) {
      triggerDate = date;
      // Entire closed-day paid Delivery sales (not the 09:00 crossing subtotal,
      // and NOT the cumulative threshold or preceding days).
      baseCents = cents;
      kind = "delivery_threshold";
    } else if (triggerDate && date !== triggerDate && cents > 0) {
      baseCents = cents;
      kind = "delivery_daily";
    }
    const shareCents = Math.round(baseCents * config.deliveryShareRate / 100);
    totalShareCents += shareCents;
    if (kind && shareCents > 0) invoices.push({
      id: kind === "delivery_threshold" ? `${cycle.id}:delivery:trigger` : `${cycle.id}:delivery:${date}`,
      kind, date, dueDate: date, suspendFrom: nextDate(date),
      calculationBase: baseCents / 100, amount: shareCents / 100,
    });
    days.push({ date, deliverySales: cents / 100, cumulativeDeliverySales: cumulativeCents / 100,
      billed: shareCents / 100, triggered: triggerDate === date });
  }
  const mode = triggerDate ? "delivery_share" : cycle.firstCycle ? "trial_free" : "fixed_monthly";
  const fixedFee = mode === "fixed_monthly" ? config.monthlyFee : 0;
  if (fixedFee > 0) {
    invoices.push({ id: `${cycle.id}:monthly:fixed`, kind: "fixed_monthly", date: cycle.lastDate,
      dueDate: cycle.lastDate, suspendFrom: cycle.endDate, calculationBase: fixedFee,
      amount: fixedFee, issueAtCycleClose: true });
  }
  const shareFee = roundSatang(totalShareCents / 100);
  return { cycleId: cycle.id, cycleStart: cycle.startDate, cycleEnd: cycle.endDate,
    cycleLastDate: cycle.lastDate, firstCycle: cycle.firstCycle, mode, triggerDate,
    totalDeliverySales: cumulativeCents / 100, fixedFee, deliveryShareFee: shareFee,
    totalFee: roundSatang(fixedFee + shareFee),
    slipUnlimited: Boolean(triggerDate), slipQuota: triggerDate ? null : config.monthlySlipQuota,
    invoices, days, config };
}
function overdueInvoices({ invoices = [], paidIds = [], onDate }) {
  const day = validDate(onDate), paid = new Set(paidIds);
  return invoices.filter(invoice => Number(invoice.amount) > 0
    && invoice.suspendFrom <= day && !paid.has(invoice.id));
}
module.exports = { DEFAULT_SETTINGS, normalizeSettings, calculateCycle, overdueInvoices,
  dateKey, validDate, nextDate, prevDate, anchorAtMonth, billingCycle,
  billingCycleById, cycleWindow };
