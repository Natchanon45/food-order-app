# Phase3AD — demo-only financial-day transaction cutoff
Updated 2026-10-21 Asia/Bangkok. SOURCE CANDIDATE, NOT PRODUCTION.

## Scope
`functions/hybrid-billing-writer-epoch-candidate.js` adds `initializeHybridDemoDayCutoffCandidate` and `sealHybridDemoDayCutoffCandidate` (not exported in `functions/index.js`) and augments `requireHybridEpochAdmissionCandidate` when the opt-in Epoch contains `dayCutoffDemoDate`. One active Bangkok day `YYYY-MM-DD` per demo epoch, no rollover or late correction.

## Transaction correctness
- Both actions enforce `GCLOUD_PROJECT=demo-penguin-hybrid-uat`, loopback `FIRESTORE_EMULATOR_HOST` and active `super_admin` in the real Firestore transaction.
- The day document lives at `tenants/{tenantId}/hybridBillingDayCutoffCandidates/{YYYY-MM-DD}`, created with `candidateOnly:true`, `status:"open"`, `coverageCertified:false`, `canIssueInvoice:false`. An epoch marker is committed atomically with day creation; second activation fails closed.
- Each enrolled DEMO Gateway path derives `sourceDay` from its independently/server-validated financial source time and reads the day doc within its existing financial Firestore transaction BEFORE any order/journal writes. Another day is rejected. Day SEAL updates this exact doc in another transaction, introducing a transaction-visible conflict for any concurrent accepted writer, which must retry and refuse under sealed state; no all-writer coverage is assumed.
- Four enrolled paths: COD server clock, PromptPay bank `paidAt`, initial bank refund `refundAt`, partial bank refund `refundAt`. Not enrolled: original raw unexported candidate calls without demo admission, deployed legacy and arbitrary Admin SDK writers, future Lalamove remittance, public Client SDK routes.
- A SEAL preserves historical Epoch open status, not financial invoices, not a certified immutable day manifest. The day cannot be reopened through this candidate. Late settlement/backdate must be rejected for that source day until future reviewed append-only adjustment design implemented.
- Tests: source-only contract unit tests `tests/react-parity/hybrid-billing-privileged-writer-ingress.spec.mjs`; real Firestore integration in `hybrid-billing-firestore-emulator.spec.mjs` Phase3AD. Both must pass on current HEAD and Emulator only before using as evidence.
- `coverageCertified:false`, `sourceCompletenessProven:false`, `immutableFinancialDayManifest:false`, `canIssueInvoice:false`. Do not export/activate in production, do not deploy, or use to generate a bill.

## Next architecture gates
1. Make all client/API/Admin/legacy/import/backup/payment source paths either formally admitted or fail-closed (currently incomplete).
2. Move from single demo-day coordinator to multi-day reliable source-sequence cutover; bank/Wallet POSTED cash + Lalamove REMITTED evidence with anti-replay and multi-order allocations; atomic manifests with authenticated source lineage and late settlement corrections.
3. 10k actual COD journal writer concurrency already demonstrated at 2 workers (40.05/s), higher 4/8/32 contention/index load remains unproved; Finance/Security and Thai tax/legal, App Check actual-device signoffs remain BLOCKED.

All four release flags FALSE; no live financial data touched.

## 2026-10-21 — Phase3AD VERIFIED CI for demo day cutoff and ingress checks
- CODE HEAD `00e2084baf6917448a583bf23604d2bd5ddf0ed7`: Push [39552107149](https://github.com/Natchanon45/food-order-app/actions/runs/39552107149) **SUCCESS 6/6**, PR [39552112981](https://github.com/Natchanon45/food-order-app/actions/runs/39552112981) **SUCCESS 6/6**. Hybrid Node **139/139 PASS** (3 new privileged ingress source-only regression tests), actual isolated Firestore Emulator **65 PASS + 2 TODO** (new Phase3AD all-four writer day seal test PASS), Auth+Firestore Rules **11/11 PASS**, other Functions/Auth/Storage/React/Operations PASS.
- Phase3AD docs HEAD `acdb1e6d6adf476ea4c5c3830007f00e54a8e0f4`: Push [39552572569](https://github.com/Natchanon45/food-order-app/actions/runs/39552572569) **SUCCESS 6/6** and PR [39552576572](https://github.com/Natchanon45/food-order-app/actions/runs/39552576572) **SUCCESS 6/6**. A subsequent docs-only commit will change HEAD again; must check its own Actions before claiming latest HEAD green.
- Phase3AC dedicated true DEMO 10,000 COD Journal Writer TX [39549726863](https://github.com/Natchanon45/food-order-app/actions/runs/39549726863) **SUCCESS** 1/1 (2 workers, 10000 real source writer tx, 10000 receipts, sum shard versions 10000, 0 exceptions, 40.05 tx/s P50 9ms P95 16ms P99 2014ms); initial 8-worker 39549202657 FAILED ABORTED, higher concurrency not certified.
- All certification flags and 4 release readiness flags FALSE; this is a single-day OPTIONAL demo gate, not all-Admin writer coverage or immutable real day manifest; real bank/Wallet posted credit and Lalamove COD paid-out remain unverified, Thai tax/AR, App Check real devices and Finance/Security approval still BLOCKED. No deployments, real financial writes or PR merge.
