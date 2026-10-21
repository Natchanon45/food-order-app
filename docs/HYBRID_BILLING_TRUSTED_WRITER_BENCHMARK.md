# Phase 3AC — REAL 10,000 Trusted COD Receipt Journal Transactions (Emulator)

Date: 2026-10-21 (Asia/Bangkok). **CI BENCHMARK, NOT A LIVE PAYMENT, NOT GLOBAL WRITER COVERAGE.**

## Exact test and execution path

- `tests/react-parity/hybrid-billing-trusted-journal-benchmark.spec.mjs`
- `tools/run-hybrid-billing-emulator.mjs` fixed `HYBRID_EMULATOR_TEST_TARGET=journal-scale`
- `.github/workflows/hybrid-billing-trusted-journal-scale.yml`: GitHub hosted Java 21, Node 22, Firebase Emulator 15.34.0, separate from six no-deploy release-gate jobs.
- Code SHA that introduced 10k workflow: `10645cc74523eeb98b314839a582d3338df5a14d`.
- Real workflow (check live job outcome; **DO NOT assume PASS**): https://github.com/Natchanon45/food-order-app/actions/runs/39549202657

## What is actually measured

1. Create 10,000 distinct initially UNPAID Delivery COD orders on **localhost Firestore Emulator only** under `demo-penguin-hybrid-uat` using 400/order prefill batches. Prefill is **not counted** as trusted writer transactions.
2. Activate a single synthetic Hybrid tenant and synthetic Super Admin profile and initialize the already-existing Phase3W source-only demo Epoch.
3. Execute the EXISTING `executeHybridDemoEnforcedWriter({sourceKey:"cod_cashier"})` for **every one of the 10,000 orders** with 8 concurrent workers. Each invokes the real `settleHybridCodDeliveryPayment` Firestore transaction; it must atomically update Paid+canonical `paidAt`, create its own immutable receipt journal document and advance the corresponding one of 16 transaction fences. No batch spoofing of paid/journal source fields qualifies.
4. Verify count(Paid Orders) = count(Receipt Events) = SUM(16 actual fence versions) = 10,000, with no failures. Run the existing real read-only paginated journal manifest witness (max 200 rows/page, <=100 pages), require **zero** journal exceptions.
5. Seal the demo Epoch and prove a further new COD Writer operation refuses with `HYBRID_EPOCH_CLOSED`. Check no real tenant coverageReady, no candidate invoice.
6. Log preparation, writer, read-only audit and total durations, throughput and transaction P50/P95/P99 in the GitHub Actions logs as `HYBRID_PHASE3AC_ACTUAL_TRUSTED_WRITER_BENCHMARK`.

## Boundaries / correctness

- This benchmarks REAL FIRESTORE JOURNAL TRANSACTIONS, but the cashier user/tenant/receipts are synthetic: `authenticatedRealBankCredits:0`, `authenticatedLalamovePayouts:0`. No third-party bank or COD remittance proof.
- 16 sharded fences measure admitted candidate transaction concurrency; they do NOT prove cross-page atomic day cutoff, source-complete global coverage, authenticated provider credit or universal Admin SDK gate.
- Only opted-in existing gateway used; old raw candidate and unregistered legacy Admin SDK writers may still bypass the same epoch. Independent Finance/Security approval remains mandatory.
- `coverageCertified:false`, `immutableFinancialDayManifest:false`, `canIssueInvoice:false` regardless of benchmark success. >3k invoice safety cap stays unchanged.
- This separate path-scoped GitHub Actions benchmark auto-runs when its workflow/test/runner file changes; updates to docs do not retrigger the expensive test. Existing standard Push/PR workflow remains six checks, no deploy.
- Hard fail for wrong project, remote Emulator, missing explicit mode, non-integer/above-10k order count, or concurrency outside 1–32. No data or resource writes outside isolated demo runner.
- **Do not mark passed unless run 39549202657 completes SUCCESS with actual 10,000 confirmed in logs.** On failure, fix workload and rerun/commit source, retaining fail-closed state.

## Remaining release blockers

Universal Admin SDK/legacy/client/future Lalamove trusted source admission, posted-credit bank/Wallet and Lalamove independent provider payout receipts, stable race-free global immutable Financial Day Manifest/late correction, production-equivalent indexes/load and real financial-accounting Thai tax/AR/refund signoff, App Check real staging devices/domain, 2 Firestore TODO and Owner/Super Admin UAT. No deploy, no PR merge.


## 2026-10-21 — Phase3AC VERIFIED 10,000 real trusted journal writer transactions on isolated Emulator
- Dedicated GitHub scale run [39549726863](https://github.com/Natchanon45/food-order-app/actions/runs/39549726863) **SUCCESS** on CODE `470f291f0c8649368d9da0ada5b2e50748ff4454`: **10,000 actual existing `executeHybridDemoEnforcedWriter` COD Firestore Transactions**, 2 concurrent workers, **10,000 successful**, **0 failed**, **0 external ABORTED retries**, paid orders=10,000, immutable Receipt Events=10,000, sum of 16 fence increments=10,000, read-only journal Manifest scanned 50 pages/10,000 rows **0 issues**. After demo Epoch SEAL, new COD attempted payment rejected. No invoices created, no coverage-ready flag. These are 10k GENUINE TRUSTED SOURCE WRITER TRANSACTIONS on **EMULATOR**, not 10k fake `paymentReceiptSource` claims.
- Actual measured benchmark: seed 1,237 ms; writer 249,667 ms; **40.05 tx/s**, P50 9 ms, P95 16 ms, P99 2,014 ms; read-only journal audit 9,232 ms; total 262,014 ms. Performance is for this 2-concurrent local Emulator runner; not a production SLO, real provider/bank performance or 8/32-concurrency result.
- Prior initial 8-worker scale [39549202657](https://github.com/Natchanon45/food-order-app/actions/runs/39549202657) **FAILED** Firestore Emulator `ABORTED: Transaction lock timeout`; retained as concurrency contention evidence, NOT deleted/hidden. Source-only bounded retries remain in benchmark but successful 2-worker run needed none. NEXT rerun 4/8/32 concurrency with contention and index plan review under isolated Emulator; no automatic claim of throughput/index readiness.
- Last pre-this-docs HEAD `37adddf74d4d863bb8b82c05518995bd1641375f`: Standard CI Push [39550184572](https://github.com/Natchanon45/food-order-app/actions/runs/39550184572) **SUCCESS 6/6**, PR [39550190104](https://github.com/Natchanon45/food-order-app/actions/runs/39550190104) **SUCCESS 6/6**; Hybrid Node **136/136 PASS**, Auth+Firestore Rules **11/11 PASS**, existing original Firestore Emulator **64 PASS + 2 TODO** (the separate 10k scale has 1/1 PASS). The next docs-only HEAD MUST get its OWN Push+PR verified before claiming that new HEAD green.
- Scope: synthetic Server COD cashier and test-only demo epoch/gateway, **0 independently authenticated real bank credits, 0 real Lalamove COD paid-out evidence**, no global Admin SDK/all-writer mandatory routing, no true immutable Financial Day Manifest or late cash correction proof, no production-grade Firestore index validation, Thai VAT/credit/debit/refund/AR signoff, device/domain App Check UAT or Finance/Security approval. `coverageCertified=false`, `canIssueInvoice=false` remain nonnegotiable.
- All four flags **FALSE**: `HYBRID_REGISTRATION_READY`, `HYBRID_COD_CASHIER_CUTOVER_READY`, `HYBRID_FINANCE_UI_READY`, `HYBRID_FINANCE_API_READY`. No `functions/index.js` candidate export, no real `hybridReceiptJournalCoverageReady`, NO Firebase Deploy, NO PR #7 merge, NO live financial tenant/order writes, no Mac MCP/reset/clean/checkout.
