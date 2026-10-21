// Phase3AD checked-in SOURCE-ONLY static ingress regression. Static source review
// CANNOT prove global Admin SDK financial writer coverage; it catches obvious
// new direct PAID literals on deployed modules and finance candidate exports.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("functions");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");

test("Phase3AD audited deployed server direct PAID literals require explicit review", () => {
  const expected = new Map([
    ["delivery-slip.js", 2],    // legacy Slip2Go and cashier manual: tenant tx guards
    ["operational-orders.js", 1], // walk-in (NOT Delivery) new order
  ]);
  const observed = [];
  const paymentLiteral = /\bpaymentStatus\s*:\s*["']paid["']/g;
  for (const file of fs.readdirSync(ROOT).filter(s => s.endsWith(".js") && !s.startsWith("hybrid-billing-"))) {
    const count = [...read(file).matchAll(paymentLiteral)].length;
    if (count) {
      assert.ok(expected.has(file), "UNREVIEWED_DEPLOYED_PAID_WRITER: " + file);
      assert.equal(count, expected.get(file), "PAID_WRITER_COUNT_CHANGED: " + file);
      observed.push(file);
    }
  }
  assert.deepEqual(observed.sort(), [...expected.keys()].sort());
  // Regex is a defensive review tripwire, not a full data-flow/runtime proof.
});

test("Phase3AD legacy Delivery routes still fail closed and Lalamove status cannot post COD cash", () => {
  const slip = read("delivery-slip.js");
  assert.equal((slip.match(/legacyDeliveryPaidWriterAllowed\(/g) || []).length, 2);
  assert.equal((slip.match(/HYBRID_TRUSTED_JOURNAL_WRITER_REQUIRED/g) || []).length, 2);
  const lifecycle = read("lalamove-order-lifecycle.js");
  const webhook = read("lalamove-webhook.js");
  assert.ok(lifecycle.includes("Do not set paymentStatus/paidAt here"));
  assert.doesNotMatch(webhook, /paymentStatus\s*:\s*["']paid["']|paidAt\s*:/);
  assert.doesNotMatch(lifecycle, /paymentStatus\s*:\s*["']paid["']|paidAt\s*:/);
  const backup = read("retail-pos-backup.js");
  const collections = backup.slice(backup.indexOf("const FULL_COLLECTIONS"), backup.indexOf("const SCOPED_COLLECTIONS"));
  assert.ok(!collections.includes('"orders"'), "POS backup must never restore paid Delivery Order rows");
});

test("Phase3AD four unexported demo writers all carry authoritative financial source day", () => {
  const required = new Map([
    ["hybrid-billing-cod-payment.js", 'sourceDay:dateKey(receivedAt)'],
    ["hybrid-billing-promptpay-payment.js", 'sourceDay:dateKey(proof.paidAt)'],
    ["hybrid-billing-refund-reversal.js", 'sourceDay:dateKey(proof.refundAt)'],
    ["hybrid-billing-multi-refund.js", 'sourceDay:dateKey(proof.refundAt)'],
  ]);
  for (const [file, fragment] of required) {
    const source = read(file);
    assert.ok(source.includes(fragment), "MISSING_DEMO_DAY_CUTOFF_ADMISSION: " + file);
    assert.ok(source.includes("requireHybridEpochAdmissionCandidate({"), file);
  }
  const index = read("index.js");
  assert.ok(!index.includes("initializeHybridDemoDayCutoffCandidate"));
  assert.ok(!index.includes("sealHybridDemoDayCutoffCandidate"));
  assert.ok(!index.includes("hybrid-billing-demo-enforced-writer"));
  assert.ok(!index.includes("hybrid-billing-writer-epoch-candidate"));
  assert.ok(!index.includes("hybridCodCashierPaymentCandidate"));
});
