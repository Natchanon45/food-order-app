# PENGUIN Hybrid Billing — Phase 3AB trusted financial cutoff and late-arrival architecture

**Status: DESIGN ONLY, NOT IMPLEMENTED, NOT FINANCE/SECURITY CERTIFIED, NEVER DEPLOY.**
Repository `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, Draft PR #7.
Date: 2026-10-21 (Asia/Bangkok). Complements `HYBRID_BILLING_WRITER_INVENTORY.md`.

## Threat model and prerequisites

A Firestore query or cursor over paid Delivery orders is NOT an atomic financial snapshot. The 16-shard receipt fences reduce contention but do NOT certify that every producer participates or that an order written between paginated reads cannot escape detection. Firebase Admin SDK bypasses Firestore Security Rules; a demo epoch barrier that only four source-only candidates opt into cannot prevent legacy server or browser writes. Therefore `coverageCertified`, `writerParticipationComplete`, `sourceCompletenessProven`, `immutableFinancialDayManifest`, and `canIssueInvoice` remain false, regardless of scan counts.

Financial admission requires an authoritative authenticated server writer source registry BEFORE this architecture can run. Every route capable of paid/refund/settlement mutation, including legacy Cashier/Slip2Go, Admin SDK, restore/import, bank, future Lalamove remittance, browser and REST must either (A) atomically enroll in the journal or (B) fail closed for Hybrid. Last-mile courier delivery COMPLETED is never evidence of COD money remitted.

## Invariants for a future implementation

1. Assign each business event a stable `sourceEventId` tied to authenticated ingress and provider statement; store `sourceType`, `providerEventHash`, `bankStatementIdHash`, `tenantId`, `orderId`, `recordedAt`, `trustedPaidAt`, and immutable amounts in integer THB satang. Never trust caller-supplied timestamps, amount, reviewer, bank posting or client-selected route.
2. Treat the `Asia/Bangkok` accounting day as `[00:00, next 00:00)` with a canonical UTC interval. Anniversary cycle reset remains independent of Financial Day: signup 16 October -> reset 16 November (exclusive cycle end). Trigger-day threshold share uses all CLOSED paid Delivery sales for that Bangkok day, not a 09:00 partial invoice.
3. Separate money timelines: `courierDeliveredAt`, `providerRemittedAt`, `bankOrWalletPostedAt`, `trustedPaidAt`, `journalCommittedAt`, `financialDayFinalizedAt`; settlement received later cannot backdate a closed manifest silently.
4. Every accepted paid/refund mutation commits order state + provider-verified receipt/refund journal + idempotent event claim + generation/fence reference atomically, or none. Provider proof must be replay-resistant across tenants, invoices and batches.
5. Global writer admission and day finalization MUST share a transaction-visible barrier. Set day `closing`, reject NEW admissions for that day, wait for admitted in-flight transactions to commit/abort, and use a deterministic ledger sequence/watermark. A scan with before/after versions but no admission fence is advisory only. A single hot daily coordinator might bottleneck; 16 existing shard fences cannot on their own prove a single consistent cutoff. Load-test whichever final design is selected.
6. Day manifest commits canonical sorted `sourceEventId` + event content digest, event count, gross/refund/net satang, shard counts/roots, provider statement reference hashes, source-registry digest, cutoff barrier generation, UTC/Bangkok boundary, previous manifest hash and creation actor. Never claim immutable until a stable source-complete snapshot and cardinality checks are verified.
7. At end of day: state `OPEN -> CLOSING -> SEALED`; fails, stale cursors, missing journals, duplicate claim, backdated provider events, unregistered writer, source change or inconclusive pagination => `BLOCKED`, **no invoice**. Sealed records must never be edited or deleted by client/legacy server. Do not lift the existing greater-than-3,000 paid-source invoice safety limit.
8. After seal, late settlement/refund/chargeback is an append-only CORRECTION/AR event on the next eligible OPEN financial day, linked to immutable original order, receipt, provider trace and original day hash. Preserve previous day manifest/invoice, and generate credit/debit/AR proposals only after Thai legal/accounting sign-off. Avoid silently rewriting closed day amounts or using late funds to certify historic money earlier.
9. COD remittance verified independently: Lalamove event type and authenticated provider statement must describe a REMITTED/PAID_OUT cash amount, currency and payout ID; then independently query actual posted bank/Wallet credit, reconcile net/gross, provider deductions, multi-order allocations and reversals. If absent or ambiguous, `settlementPending=true` and zero claim of received cash.
10. All candidate surfaces are source-only, unexported, no production tenant coverage flag, and four release flags remain false until approvals.

## Suggested staged data model — names are conceptual, not deployed

- `tenants/{tenantId}/hybridWriterRegistry/{sourceKey}`: privileged immutable approved writer identity/version, safety owner, expected provider proofs and coverage enrollment. **Never** allow client writes.
- `tenants/{tenantId}/hybridBillingAdmissionDays/{yyyy-mm-dd}`: OPEN/CLOSING/SEALED barrier and opaque generation; all trusted financial transactions must read it before mutations.
- `tenants/{tenantId}/hybridBillingFinancialEvents/{sourceEventId}`: immutable event + immutable provider/bank lineage and explicit `effectiveDay`.
- `platformHybridProviderClaims/{issuer}:{hashedEventId}`: global replay claim (sized/idempotent with strict source identity); no raw secrets or bank account numbers in public docs.
- `tenants/{tenantId}/hybridBillingDayManifests/{yyyy-mm-dd}`: frozen manifest and prior digest, ONLY emitted after exhaustive settled source and journal verification.
- `tenants/{tenantId}/hybridBillingLateCorrections/{sourceEventId}`: one-time linked next-open-day compensating entries; do not mutate previous manifest.

## Gate-oriented verification (NOT complete)

- Negative source tampering: client forged paid, Admin SDK legacy bypass, future unknown source, backdated payment, paid order deletion, spoofed Lalamove completed, reused provider event, duplicate cross-tenant payout, insufficient/missing bank POSTED credit => all rejected or flagged with missing journal; no invoice.
- Real Emulator: **10,000 actual authenticated candidate financial writer journal transactions**, NOT merely 10k fabricated paid records. Vary 1, 8, 32 concurrent writers; record P50/P95/P99 commit/transaction retries, index usage, 16-shard hot contention, memory, errors, bounded reads, pagination sentinel/scale; simulate cutoff while writers are in flight.
- Prove source count == journal event count == provider matched allocations under immutable barrier, with no pending writer at seal. Seek Finance + Security independent sign-off on reconciliation, Thai VAT/credit/debit notes, refunds and AR, plus actual App Check PC/tablet/mobile staging UAT.
- Two existing Firestore Emulator TODOs remain. Existing CI never validates bank+Lalamove live remittance; do not recast them as green.

No production data writes, bank settlement, Firebase Deploy or Draft PR merge authorized.
