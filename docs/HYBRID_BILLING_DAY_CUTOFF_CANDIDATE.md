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