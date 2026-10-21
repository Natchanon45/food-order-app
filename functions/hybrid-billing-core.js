"use strict";

// Pure, side-effect-free calculator for the 2026 PENGUIN hybrid billing policy.
// Only pass server-validated PAID Delivery merchandise sales, never POS, shipping or client totals.
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
function nextDate(s) { return new Date(Date.parse(validDate(s) + "T00:00:00Z") + 86400000).toISOString().slice(0, 10); }
function roundSatang(baht) { return Math.round((baht + Number.EPSILON) * 100) / 100; }

function calculateMonth({ month, firstMonth = false, dailyDeliverySales = [], settings = {} }) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ""))) throw new RangeError("Invalid billing month");
  if (typeof firstMonth !== "boolean" || !Array.isArray(dailyDeliverySales)) throw new TypeError("Invalid inputs");
  const config = normalizeSettings(settings);
  const sales = new Map();
  for (const item of dailyDeliverySales) {
    const day = validDate(item?.date);
    if (!day.startsWith(month + "-")) throw new RangeError("Daily sale outside month");
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
      // Charge only the Delivery goods sold on the closed trigger day.
      // Previous days determine threshold crossing but are not re-billed.
      baseCents = cents;
      kind = "delivery_threshold";
    } else if (triggerDate && date !== triggerDate && cents > 0) {
      baseCents = cents;
      kind = "delivery_daily";
    }
    const shareCents = Math.round(baseCents * config.deliveryShareRate / 100);
    totalShareCents += shareCents;
    if (kind && shareCents > 0) invoices.push({
      id: kind === "delivery_threshold" ? `${month}:delivery:trigger` : `${month}:delivery:${date}`,
      kind, date, dueDate: date, suspendFrom: nextDate(date),
      calculationBase: baseCents / 100, amount: shareCents / 100
    });
    days.push({ date, deliverySales: cents / 100, cumulativeDeliverySales: cumulativeCents / 100,
      billed: shareCents / 100, triggered: triggerDate === date });
  }
  const mode = triggerDate ? "delivery_share" : firstMonth ? "trial_free" : "fixed_monthly";
  const fixedFee = mode === "fixed_monthly" ? config.monthlyFee : 0;
  if (fixedFee > 0) {
    const [y, m] = month.split("-").map(Number);
    const lastDate = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    invoices.push({ id: `${month}:monthly:fixed`, kind: "fixed_monthly", date: lastDate,
      dueDate: lastDate, suspendFrom: nextDate(lastDate), calculationBase: fixedFee,
      amount: fixedFee, issueAtMonthClose: true });
  }
  const shareFee = roundSatang(totalShareCents / 100);
  return { month, firstMonth, mode, triggerDate, totalDeliverySales: cumulativeCents / 100,
    fixedFee, deliveryShareFee: shareFee, totalFee: roundSatang(fixedFee + shareFee),
    slipUnlimited: Boolean(triggerDate), slipQuota: triggerDate ? null : config.monthlySlipQuota,
    invoices, days, config };
}
function overdueInvoices({ invoices = [], paidIds = [], onDate }) {
  const day = validDate(onDate), paid = new Set(paidIds);
  return invoices.filter(invoice => Number(invoice.amount) > 0
    && invoice.suspendFrom <= day && !paid.has(invoice.id));
}

function prevDate(s) {
  return new Date(Date.parse(validDate(s) + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
}

// The signup date is the anchor, including shorter/leap months (31 Jan -> 28 Feb -> 31 Mar).
function anchorAtMonth(signupDate, monthsAfter) {
  const [year, month, day] = validDate(signupDate).split("-").map(Number);
  if (!Number.isSafeInteger(monthsAfter) || monthsAfter < 0 || monthsAfter > 1200) {
    throw new RangeError("Invalid billing cycle offset");
  }
  const ym = new Date(Date.UTC(year, month - 1 + monthsAfter, 1));
  const y = ym.getUTCFullYear(), m = ym.getUTCMonth() + 1;
  const finalDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(day, finalDay)).padStart(2, "0")}`;
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
    firstCycle: offset === 0,
  });
}
function billingCycleById(signupDate, cycleId) {
  const cycle = billingCycle(signupDate, validDate(cycleId));
  if (cycle.id !== cycleId) throw new RangeError("Invalid billing cycle ID");
  return cycle;
}
function cycleWindow(cycle) {
  return {
    start: new Date(`${validDate(cycle.startDate)}T00:00:00+07:00`),
    end: new Date(`${validDate(cycle.endDate)}T00:00:00+07:00`),
  };
}

// Prospective anniversary-cycle projection, separate from legacy calendar-month test helpers.
// Does not issue invoices, suspend Tenants or collect money.
function calculateCycle({ signupDate, cycleId, dailyDeliverySales = [], settings = {} }) {
  const cycle = billingCycleById(signupDate, cycleId);
  if (!Array.isArray(dailyDeliverySales)) throw new TypeError("Invalid dailyDeliverySales");
  const config = normalizeSettings(settings), sales = new Map();
  for (const item of dailyDeliverySales) {
    const day = validDate(item?.date);
    if (day < cycle.startDate || day >= cycle.endDate) throw new RangeError("Daily sale outside cycle");
    const amount = validateMoney(item?.amount, "dailyDeliverySales.amount");
    sales.set(day, (sales.get(day) || 0) + Math.round(amount * 100));
  }
  let totalSales = 0, shareTotal = 0, triggerDate = null;
  const threshold = Math.round(config.deliveryThreshold * 100), invoices = [], days = [];
  for (const [day, cents] of [...sales.entries()].sort((a,b) => a[0].localeCompare(b[0]))) {
    totalSales += cents;
    let base = 0, kind = null;
    if (!triggerDate && totalSales >= threshold) {
      triggerDate = day;
      base = cents; // Only goods paid on the threshold DAY; never rebill previous days.
      kind = "delivery_threshold";
    } else if (triggerDate && day !== triggerDate && cents > 0) {
      base = cents;
      kind = "delivery_daily";
    }
    const charged = Math.round(base * config.deliveryShareRate / 100);
    shareTotal += charged;
    if (kind && charged > 0) invoices.push({
      id: kind === "delivery_threshold" ? `${cycle.id}:delivery:trigger` : `${cycle.id}:delivery:${day}`,
      kind, date: day, dueDate: day, suspendFrom: nextDate(day),
      calculationBase: base / 100, amount: charged / 100,
    });
    days.push({ date: day, deliverySales: cents / 100,
      cumulativeDeliverySales: totalSales / 100, billed: charged / 100,
      triggered: triggerDate === day });
  }
  const mode = triggerDate ? "delivery_share" : cycle.firstCycle ? "trial_free" : "fixed_monthly";
  const fixedFee = mode === "fixed_monthly" ? config.monthlyFee : 0;
  if (fixedFee > 0) invoices.push({
    id: `${cycle.id}:monthly:fixed`, kind: "fixed_monthly",
    date: cycle.lastDate, dueDate: cycle.lastDate, suspendFrom: cycle.endDate,
    calculationBase: fixedFee, amount: fixedFee, issueAtCycleClose: true,
  });
  const deliveryShareFee = roundSatang(shareTotal / 100);
  return {
    cycleId: cycle.id, cycleStart: cycle.startDate, cycleEnd: cycle.endDate,
    cycleLastDate: cycle.lastDate, firstCycle: cycle.firstCycle, mode, triggerDate,
    totalDeliverySales: totalSales / 100, fixedFee, deliveryShareFee,
    totalFee: roundSatang(fixedFee + deliveryShareFee),
    slipUnlimited: Boolean(triggerDate), slipQuota: triggerDate ? null : config.monthlySlipQuota,
    invoices, days, config,
  };
}

module.exports = { DEFAULT_SETTINGS, normalizeSettings, calculateMonth, calculateCycle,
  billingCycle, billingCycleById, anchorAtMonth, cycleWindow,
  overdueInvoices, dateKey, validDate };

