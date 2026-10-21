// Phase 3AC: REAL Firestore Emulator 10k COD writer transactions.
// SOURCE-ONLY: this is a synthetic DEMO authenticated cashier/epoch workload,
// NOT a live cash settlement, global writer certification, or invoice permission.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const PROJECT = "demo-penguin-hybrid-uat";
const COUNT = Number(process.env.HYBRID_JOURNAL_BENCHMARK_COUNT);
const WORKERS = Number(process.env.HYBRID_JOURNAL_BENCHMARK_WORKERS || "8");
if (process.env.GCLOUD_PROJECT !== PROJECT
  || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "")
  || process.env.HYBRID_EMULATOR_TEST_TARGET !== "journal-scale"
  || !Number.isSafeInteger(COUNT) || COUNT < 1 || COUNT > 10000
  || !Number.isSafeInteger(WORKERS) || WORKERS < 1 || WORKERS > 32) {
  throw Error("HYBRID_10K_TRUSTED_WRITER_DEMO_EMULATOR_ONLY");
}

const require = createRequire(import.meta.url);
const functionsRequire = createRequire(new URL("../../functions/hybrid-billing-cod-payment.js", import.meta.url));
const { initializeApp, deleteApp } = functionsRequire("firebase-admin/app");
const { getFirestore } = functionsRequire("firebase-admin/firestore");
const { executeHybridDemoEnforcedWriter } =
  require("../../functions/hybrid-billing-demo-enforced-writer.js");
const { initializeHybridEpochCandidate, sealHybridEpochCandidate } =
  require("../../functions/hybrid-billing-writer-epoch-candidate.js");
const { previewHybridJournalManifest } =
  require("../../functions/hybrid-billing-manifest-preview.js");

const app = initializeApp({ projectId: PROJECT }, "phase3ac-trusted-writer-benchmark");
const db = getFirestore(app);
const tenantId = "tenant-phase3ac-trusted-benchmark-001";
const actorUid = "super-phase3ac-trusted-benchmark-001";
const tenantRef = db.collection("tenants").doc(tenantId);
const orders = tenantRef.collection("orders");
const receiptEvents = tenantRef.collection("hybridBillingReceiptEvents");
const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1,
  Math.max(0, Math.ceil(sorted.length * p) - 1))];
const orderIdAt = i => "cod-phase3ac-" + String(i).padStart(6, "0");

test.after(async () => { await deleteApp(app); });

test("Phase3AC benchmark: real journaled trusted COD writer transactions, 16 fences, and sealed refusal", async () => {
  const started = performance.now();
  await tenantRef.create({
    active: true, billingPolicyVersion: "hybrid_v1",
    hybridBillingEnabled: true, businessType: "both",
    hybridBillingStartDate: "2026-10-16",
    hybridBillingSnapshot: {
      monthlyFee: 590, deliveryThreshold: 10000, deliveryShareRate: 5, monthlySlipQuota: 100,
    },
  });
  await db.collection("users").doc(actorUid).set({
    role: "super_admin", active: true, tenantId,
  });
  await initializeHybridEpochCandidate({ db, tenantId, reviewerUid: actorUid });

  const preparedStart = performance.now();
  // 400 is under Firestore's 500 writes/batch. No fabricated paid docs or journals.
  for (let start = 0; start < COUNT; start += 400) {
    const batch = db.batch();
    for (let i = start; i < Math.min(COUNT, start + 400); i++) {
      batch.create(orders.doc(orderIdAt(i)), {
        tenantId, orderType: "delivery", deliveryProvider: "self",
        paymentMethod: "cod", paymentStatus: "unpaid", status: "served",
        totalAmount: 105, subtotalAmount: 100, deliveryFee: 5,
        items: [{ id: "item", quantity: 1 }],
      });
    }
    await batch.commit();
  }
  const seedMs = performance.now() - preparedStart;
  assert.equal((await orders.count().get()).data().count, COUNT);

  const durations = new Array(COUNT);
  let nextIndex = 0;
  let successes = 0;
  const writerStart = performance.now();
  const writer = async () => {
    while (nextIndex < COUNT) {
      const i = nextIndex++;
      const startedAt = performance.now();
      const result = await executeHybridDemoEnforcedWriter({
        sourceKey: "cod_cashier",
        args: { db, tenantId, orderId: orderIdAt(i), actorUid },
      });
      assert.equal(result.alreadyPaid, false);
      durations[i] = performance.now() - startedAt;
      successes++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(WORKERS, COUNT) }, writer));
  const writerMs = performance.now() - writerStart;
  assert.equal(successes, COUNT);
  const orderedDurations = durations.sort((a, b) => a - b);
  assert.equal((await receiptEvents.count().get()).data().count, COUNT,
    "Every transaction must have created its actual immutable receipt journal");
  assert.equal((await orders.where("paymentStatus", "==", "paid").count().get()).data().count, COUNT,
    "Every originally unpaid Delivery must now be paid by the trusted writer");
  const fences = await Promise.all(Array.from({ length: 16 }, (_, shard) =>
    tenantRef.collection("hybridBillingReceiptFences").doc("shard-" + String(shard).padStart(2, "0")).get()));
  assert.ok(fences.every(s => s.exists && Number.isSafeInteger(s.data()?.version)));
  assert.equal(fences.reduce((sum, s) => sum + s.data().version, 0), COUNT,
    "Every real journaled writer must advance exactly one transaction fence");

  // Paginated witness compares actual paid source and immutable journal.
  // It is advisory: missing legacy ingress and non-atomic global cutoff still block billing.
  const scanStarted = performance.now();
  const manifest = await previewHybridJournalManifest({
    db, tenantId, pageSize: 200, maxPages: Math.min(100, Math.ceil(COUNT / 200) + 1),
  });
  const scanMs = performance.now() - scanStarted;
  assert.equal(manifest.scanned, COUNT);
  assert.equal(manifest.issueCount, 0);
  assert.equal(manifest.coverageCertified, false);
  assert.equal(manifest.canIssueInvoice, false);

  await sealHybridEpochCandidate({ db, tenantId, reviewerUid: actorUid });
  const afterId = "cod-phase3ac-after-seal-001";
  await orders.doc(afterId).create({
    tenantId, orderType: "delivery", paymentMethod: "cod",
    paymentStatus: "unpaid", status: "served", totalAmount: 105,
    subtotalAmount: 100, deliveryFee: 5, items: [{ id: "item", quantity: 1 }],
  });
  await assert.rejects(executeHybridDemoEnforcedWriter({
    sourceKey: "cod_cashier", args: { db, tenantId, orderId: afterId, actorUid },
  }), /HYBRID_EPOCH_CLOSED/);
  assert.equal((await orders.doc(afterId).get()).data().paymentStatus, "unpaid");
  assert.equal((await receiptEvents.count().get()).data().count, COUNT);
  assert.equal((await tenantRef.get()).data().hybridReceiptJournalCoverageReady, undefined);
  assert.equal((await tenantRef.collection("hybridBillingInvoices").count().get()).data().count, 0);

  console.log("HYBRID_PHASE3AC_ACTUAL_TRUSTED_WRITER_BENCHMARK", JSON.stringify({
    actualTrustedJournalTransactions: COUNT, workers: Math.min(WORKERS, COUNT),
    successful: successes, failed: 0, journalEvents: COUNT, fenceVersionSum: COUNT,
    seedMs: Math.round(seedMs), writerMs: Math.round(writerMs),
    transactionsPerSecond: +(COUNT / (writerMs / 1000)).toFixed(2),
    p50Ms: Math.round(percentile(orderedDurations, 0.50)),
    p95Ms: Math.round(percentile(orderedDurations, 0.95)),
    p99Ms: Math.round(percentile(orderedDurations, 0.99)),
    scanMs: Math.round(scanMs), scanPages: manifest.pages,
    totalMs: Math.round(performance.now() - started),
    authenticatedRealBankCredits: 0, authenticatedLalamovePayouts: 0,
    globalSourceCompletenessProven: false, immutableFinancialDayManifest: false,
    coverageCertified: false, canIssueInvoice: false,
  }));
});
