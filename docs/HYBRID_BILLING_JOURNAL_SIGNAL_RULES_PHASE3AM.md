# Phase 3AM — Journal-only migration signal parity in Firestore Client Rules

Date: 2026-10-21 (Asia/Bangkok). **SOURCE-ONLY, NOT DEPLOYED.**

## Detected inconsistency
In Phase3AL, the Cashier UI classified any tenant with `hybridReceiptJournalCoverageReady === true` or non-null `hybridReceiptJournalMode` as a transitional Hybrid financial tenant and denied legacy browser Paid writes. The backend `legacyDeliveryPaidWriterAllowed` also rejected these markers. However, the Client Firestore Rules treated a tenant as Hybrid only if `billingPolicyVersion='hybrid_v1'` or `hybridBillingEnabled=true`. Journal-only/Legacy-policy tenants could therefore still edit Delivery Paid/receipt metadata using the Client SDK, and suspended journal-only tenants could retain legacy client access.

## Source-only candidate
`firestore.rules` introduces `hybridFinancialSignal(tenant)` (evaluated from Firestore tenant document) with four OR triggers: `hybrid_v1`, `hybridBillingEnabled==true`, `hybridReceiptJournalCoverageReady==true`, or `hybridReceiptJournalMode != null`. It is reused in:
- `tenantBusinessEnabled` — suspended journal-marked tenants cannot bypass the read/business gate solely by Legacy policy.
- `isHybridTenant` — inherited protection against paid Delivery delete.
- `hybridOperationalWriteAllowed` — consistent suspended/inactive client restriction.
- `hybridDeliveryReceiptFieldsUnchanged` — immutable client finance, settlement, receipt-review and amount fields for journal-only tenants.

Existing `hybridReceiptCoverageFieldsUnchanged` still forbids ANY Client SDK from self-certifying journal coverage. The candidate avoids auto-writing, repairing or migrating any payment, timestamp, journal, or invoice field. Fully unmarked Legacy tenant operations remain unchanged. This is **not** a replacement for Auth, server-side finance authorization, independent bank/provider reconciliation, or source-complete Admin SDK routing.

## Verified Code CI
CODE SHA: `2f85367dd0a2dc47b7928e6113b3b24acff03493`. GitHub Push run `39575515801` SUCCESS 6/6. Job logs: Hybrid Unit 166 PASS, real Firestore Emulator 77 PASS + 2 original TODO, Auth + Firestore Rules 17 PASS. New tests in `tests/react-parity/hybrid-billing-rules-emulator.spec.mjs` explicitly cover marker-only Legacy (mode and coverage) Paid/receipt metadata spoofing, paid Delivery deletion, journal-only suspension, and genuine Legacy compatibility. Check exact final HEAD Push+PR runs separately after docs.

## Remaining safety and release blockers
Firestore Client Rules are bypassed by privileged Admin SDK, direct REST imports and unreviewed backoffice/service accounts. Two historical TODO remain OPEN: non-PromptPay cashier canonical paidAt at trusted source, and source-complete suspended Hybrid client/server writer enforcement. Independently authenticated Lalamove money settlement and bank/Wallet POSTED credit, real financial cutoff/late settlement lineage, 4/8/32 concurrency, Thai tax/AR/refund approval, real App Check and Owner/Super Admin PC/tablet/mobile UAT are pending. Four readiness flags FALSE. Candidate Finance Cloud Functions stay unexported. Never treat Lalamove delivery COMPLETED as merchant COD received. No production writes/deploy/PR merge.
