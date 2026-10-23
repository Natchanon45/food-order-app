"use strict";

// A deterministic, side-effect-free invoice ledger planner. NEVER read client
// totals, send a payment request, suspend a store, or mutate a paid invoice here.
const { createHash } = require("node:crypto");
const { calculateCycle, normalizeSettings, validDate } = require("./hybrid-billing-core");

const LEDGER_VERSION = "hybrid-invoice-v1";
const STATES = Object.freeze(["issued", "pending_review", "paid", "rejected"]);
const cents = amount => Math.round(Number(amount) * 100);
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function normalizedSales(sales = [], beforeDate = null) {
  if (!Array.isArray(sales)) throw new TypeError("Daily sales must be an array");
  const days = new Map();
  for (const sale of sales) {
    const date = validDate(sale?.date);
    const amount = Number(sale?.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1e9
      || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
      throw new RangeError("Invalid paid Delivery daily amount");
    }
    if (beforeDate && date >= beforeDate) continue;
    days.set(date, (days.get(date) || 0) + cents(amount));
  }
  return [...days].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => [date, value]);
}

function invoiceSignature(invoice, period) {
  return digest({
    version: LEDGER_VERSION,
    cycleStartDate: period.cycleStartDate,
    cycleEndExclusiveDate: period.cycleEndExclusiveDate,
    id: invoice.id,
    kind: invoice.kind,
    date: invoice.date,
    dueDate: invoice.dueDate,
    suspendFrom: invoice.suspendFrom,
    amountCents: cents(invoice.amount),
    calculationBaseCents: cents(invoice.calculationBase),
  });
}

function prepareInvoiceLedger({
  cycleStartDate, cycleEndExclusiveDate, asOfDate,
  firstMonth = false, dailyDeliverySales = [], settings = {},
  existingInvoices = [], existingPeriod = null,
} = {}) {
  const today = validDate(asOfDate);
  const cycleStart = validDate(cycleStartDate);
  const cycleEnd = validDate(cycleEndExclusiveDate);
  if (today < cycleStart) throw new RangeError("Cannot issue invoices before the store billing cycle begins");
  if (cycleEnd <= cycleStart) throw new RangeError("Invalid store billing cycle");
  const fixedSettings = existingPeriod?.configSnapshot
    ? normalizeSettings(existingPeriod.configSnapshot)
    : normalizeSettings(settings);
  if (existingPeriod && (
    existingPeriod.cycleStartDate !== cycleStart ||
    existingPeriod.cycleEndExclusiveDate !== cycleEnd ||
    existingPeriod.version !== LEDGER_VERSION
  )) throw new Error("HYBRID_LEDGER_PERIOD_IDENTITY_CONFLICT");

  // All completed days are strictly earlier than the current Bangkok date.
  // A day still in progress must never get a final or collectible invoice.
  const completeThrough = today < cycleEnd ? today : cycleEnd;
  const sealedSales = normalizedSales(dailyDeliverySales, completeThrough);
  const dailyDigest = digest(sealedSales);
  if (existingPeriod?.sealedBeforeDate) {
    const oldCutoff = validDate(existingPeriod.sealedBeforeDate);
    if (oldCutoff > completeThrough || oldCutoff < cycleStart
      || oldCutoff > cycleEnd || !/^[a-f0-9]{64}$/.test(String(existingPeriod.sealedSalesDigest || ""))) {
      throw new Error("HYBRID_LEDGER_INVALID_SEAL");
    }
    const oldDigest = digest(normalizedSales(dailyDeliverySales, oldCutoff));
    if (oldDigest !== existingPeriod.sealedSalesDigest) {
      throw new Error("HYBRID_LEDGER_HISTORICAL_SALES_CHANGED_REVIEW_REQUIRED");
    }
  }
  // Even if an upstream query returns the entire future cycle, ignore all
  // entries for the current unclosed day and later days.
  const finalizedSales = sealedSales.map(([date, amountCents]) =>
    ({ date, amount: amountCents / 100 }));
  const result = calculateCycle({
    cycleStartDate: cycleStart, cycleEndExclusiveDate: cycleEnd,
    invoicePrefix: cycleStart, firstMonth, dailyDeliverySales: finalizedSales,
    settings: fixedSettings,
  });
  const endReached = today >= cycleEnd;
  const expectedInvoices = result.invoices
    .filter(row => row.issueAtMonthClose ? endReached : row.date < today)
    .map(row => {
      const record = {
        id: row.id,
        cycleStartDate: cycleStart,
        cycleEndDate: result.cycleEndDate,
        cycleEndExclusiveDate: cycleEnd,
        kind: row.kind,
        date: row.date,
        dueDate: row.dueDate,
        suspendFrom: row.suspendFrom,
        calculationBase: row.calculationBase,
        amount: row.amount,
        signature: invoiceSignature(row, result),
      };
      return Object.freeze(record);
    });
  const candidates = new Map(expectedInvoices.map(row => [row.id, row]));
  if (candidates.size !== expectedInvoices.length) throw new Error("HYBRID_LEDGER_DUPLICATE_INVOICE_KEY");
  const existing = new Map();
  for (const item of existingInvoices) {
    const id = String(item?.id || "");
    if (existing.has(id) || !id) throw new Error("HYBRID_LEDGER_DUPLICATE_EXISTING_INVOICE");
    existing.set(id, item);
    const target = candidates.get(id);
    if (!target || item.signature !== target.signature || !STATES.includes(item.status)) {
      // In particular never silently drop/reissue a previously paid invoice
      // after a retroactive payment or refund changed threshold placement.
      throw new Error("HYBRID_LEDGER_EXISTING_INVOICE_DRIFT_REVIEW_REQUIRED");
    }
  }
  return Object.freeze({
    version: LEDGER_VERSION,
    cycleStartDate: cycleStart,
    cycleEndDate: result.cycleEndDate,
    cycleEndExclusiveDate: cycleEnd,
    asOfDate: today,
    configSnapshot: fixedSettings,
    // Transaction writers must recheck the exact period revision read when
    // this plan was built; concurrent issuers may otherwise double-issue.
    priorPeriodSeal: existingPeriod
      ? { sealedBeforeDate: existingPeriod.sealedBeforeDate || null,
        sealedSalesDigest: existingPeriod.sealedSalesDigest || null }
      : null,
    sealedBeforeDate: completeThrough,
    sealedSalesDigest: dailyDigest,
    mode: result.mode,
    triggerDate: result.triggerDate,
    totalDeliverySales: result.totalDeliverySales,
    projectedAmount: result.totalFee,
    expectedInvoices,
    existingInvoiceIds: [...existing.keys()],
    newInvoices: expectedInvoices.filter(invoice => !existing.has(invoice.id)),
    // "paid" here is only an already confirmed server status; never infer
    // confirmation from an uploaded slip or an external wallet amount.
    openAmount: expectedInvoices.reduce((sum, invoice) =>
      sum + (existing.get(invoice.id)?.status === "paid" ? 0 : cents(invoice.amount)), 0) / 100,
    finalized: endReached,
    dryRun: true,
  });
}

module.exports = { LEDGER_VERSION, STATES, invoiceSignature, normalizedSales, prepareInvoiceLedger };
