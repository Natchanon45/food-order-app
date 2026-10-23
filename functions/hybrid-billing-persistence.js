"use strict";

// PRIVATE Firebase Admin transaction adapter. NOT imported from bootstrap.js.
// No public callable, scheduler, HTTP endpoint or automatic billing trigger.
const { LEDGER_VERSION, STATES } = require("./hybrid-billing-ledger");

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const asArray = val => Array.isArray(val) ? val : [];

/**
 * Persist one fully validated immutable period and closed-day invoices using
 * an injected Firestore Admin transaction runner. Retries never duplicate or
 * overwrite paid items. The ledger must use trusted server paid Delivery sales.
 */
async function persistHybridInvoiceLedger({
  db, tenantRef, ledger, serverTimestamp,
}) {
  if (!db?.runTransaction || !tenantRef?.collection || !ledger?.dryRun
    || ledger.version !== LEDGER_VERSION || !serverTimestamp) {
    throw new TypeError("Trusted Admin transaction, prepared ledger and server timestamp are required");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ledger.cycleStartDate)) {
    throw new RangeError("Invalid ledger cycle");
  }
  const periodRef = tenantRef.collection("hybridBillingPeriods").doc(ledger.cycleStartDate);
  const invoicesRef = tenantRef.collection("hybridBillingInvoices");
  if (ledger.expectedInvoices.length > 40) throw new RangeError("Invoice count exceeds cycle maximum");
  const expected = new Map(ledger.expectedInvoices.map(v => [v.id, v]));
  if (expected.size !== ledger.expectedInvoices.length) {
    throw new Error("HYBRID_LEDGER_DUPLICATE_KEYS");
  }
  const invoiceRefs = ledger.expectedInvoices.map(v => invoicesRef.doc(v.id));

  return db.runTransaction(async transaction => {
    // All reads MUST precede transaction writes.
    const periodDoc = await transaction.get(periodRef);
    const existingPeriod = periodDoc.exists ? periodDoc.data() : null;
    const prior = ledger.priorPeriodSeal;
    if (Boolean(existingPeriod) !== Boolean(prior)
      || (existingPeriod && (!same({
        sealedBeforeDate: existingPeriod.sealedBeforeDate || null,
        sealedSalesDigest: existingPeriod.sealedSalesDigest || null,
      }, prior) || existingPeriod.version !== LEDGER_VERSION))) {
      throw new Error("HYBRID_LEDGER_CONCURRENT_PERIOD_UPDATE_RETRY");
    }
    if (existingPeriod && !same(existingPeriod.configSnapshot, ledger.configSnapshot)) {
      throw new Error("HYBRID_LEDGER_CONFIG_SNAPSHOT_CONFLICT");
    }
    const previousIds = asArray(existingPeriod?.invoiceIds);
    if (previousIds.some(id => !expected.has(id))) {
      throw new Error("HYBRID_LEDGER_PREVIOUS_INVOICE_DISAPPEARED");
    }
    const docs = [];
    for (const invoiceRef of invoiceRefs) docs.push(await transaction.get(invoiceRef));
    const ids = [];
    let reused = 0;
    for (let i = 0; i < ledger.expectedInvoices.length; i++) {
      const invoice = ledger.expectedInvoices[i], snap = docs[i];
      ids.push(invoice.id);
      if (snap.exists) {
        const saved = snap.data();
        if (saved.signature !== invoice.signature || !STATES.includes(saved.status)
          || !previousIds.includes(invoice.id)) {
          throw new Error("HYBRID_LEDGER_INVOICE_CONFLICT_REVIEW_REQUIRED");
        }
        reused++;
      } else if (previousIds.includes(invoice.id)) {
        throw new Error("HYBRID_LEDGER_MISSING_PREVIOUS_INVOICE");
      }
    }
    // Replays with identical ledger state issue no additional writes.
    const noChange = existingPeriod &&
      existingPeriod.sealedBeforeDate === ledger.sealedBeforeDate &&
      existingPeriod.sealedSalesDigest === ledger.sealedSalesDigest &&
      same(previousIds, ids) && reused === ids.length;
    if (noChange) return { ok: true, created: 0, reused, unchanged: true,
      cycleStartDate: ledger.cycleStartDate };

    let created = 0;
    for (let i = 0; i < ledger.expectedInvoices.length; i++) {
      if (docs[i].exists) continue;
      const invoice = ledger.expectedInvoices[i];
      transaction.create(invoiceRefs[i], {
        ...invoice, version: LEDGER_VERSION,
        status: "issued", createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      });
      created++;
    }
    const update = {
      version: LEDGER_VERSION,
      cycleStartDate: ledger.cycleStartDate,
      cycleEndDate: ledger.cycleEndDate,
      cycleEndExclusiveDate: ledger.cycleEndExclusiveDate,
      configSnapshot: ledger.configSnapshot,
      sealedBeforeDate: ledger.sealedBeforeDate,
      sealedSalesDigest: ledger.sealedSalesDigest,
      invoiceIds: ids,
      lastEvaluatedAt: serverTimestamp,
    };
    if (existingPeriod) transaction.update(periodRef, update);
    else transaction.create(periodRef, { ...update, createdAt: serverTimestamp });
    return { ok: true, created, reused, unchanged: false,
      cycleStartDate: ledger.cycleStartDate };
  });
}

module.exports = { persistHybridInvoiceLedger };
