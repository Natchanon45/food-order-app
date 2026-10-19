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
      baseCents = thresholdCents;
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
module.exports = { DEFAULT_SETTINGS, normalizeSettings, calculateMonth, overdueInvoices, dateKey, validDate };
