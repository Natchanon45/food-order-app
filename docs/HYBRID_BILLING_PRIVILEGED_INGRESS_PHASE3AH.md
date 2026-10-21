# Phase 3AH — Privileged Paid Source Ingress and Lalamove Global Replay Candidate

Updated 2026-10-21 Asia/Bangkok. SOURCE ONLY, UNEXPORTED, NO LIVE FINANCIAL WRITES.

## Scope / source inventory

Existing exported functions in `functions/index.js` were read and inspected for known paid sources. Only Hybrid settings and read-only preview are live-exported. The two `functions/delivery-slip.js` privileged payment transitions (`finalizeDeliveryPaymentSlip` Slip2Go trigger and `approveDeliveryPaymentReview` cashier callable) have the Phase3AB same-transaction Hybrid tenant guard; they continue to serve legacy non-Hybrid, **reject Hybrid** pending trusted Journal cutover. `functions/public-delivery-submit.js` strips client payment status and creates only unpaid/pending verification Delivery. `functions/operational-orders.js` creates Paid **walkin** POS records excluded from Delivery billing. Lalamove dispatch/webhook reflects delivery lifecycle, not COD bank settlement. `functions/retail-pos-backup.js` does not restore `orders` in listed collections.

New CI source tripwire `tests/react-parity/hybrid-billing-phase3ah-ingress-map.spec.mjs` pins existing non-Hybrid Paid literal locations and known export paths; fails if new explicit `paymentStatus:'paid'` literal appears in new non-Hybrid JS. It also tests two current paid routes' transactional legacy checks and public/retail exclusions. This is **NOT** exhaustive analysis: text pattern misses computed keys, dynamic JS, SDK Admin writers across external packages, Firestore REST, imports, arbitrary Cloud Functions, client abuse, migration, stale deployed code or other runtimes. DO NOT label it global enforcement, even when CI green. Full source-attested migration and runtime owner audit are mandatory before money release.

## New demo-only global providerOrderId replay fence

Previous Phase3AG reserved (i) global bank transfer reference SHA-256 and (ii) tenant-local Order claims in the same Firestore transaction. Phase3AH additionally claims each Lalamove `providerOrderId` globally using SHA-256 `[lalamove_cod_provider_order_v1,providerOrderId]`. The transaction reads *every* provider claim before writes and on successful reservation creates the global claim alongside old batch/transfer/Order claims. Exact repeat requires all claims and witness unchanged; a missing global claim or cross-tenant/batch reuse fails closed. It does not modify Paid flags or financial receipts; these are **synthetic candidate claims**, not validated provider evidence. The extra global claim intentionally blocks reused provider IDs even when different tenants attempt different remittance transfer references. Future provider namespace/account-scope uniqueness and real server attestation must be reviewed.

The real demo Firestore Emulator negative test uses two Hybrid tenants and separate transfer reference hashes, one common provider Order ID, and explicitly checks that no second batch can be reserved or paid and a missing claim prevents idempotent recovery. An earlier intermediate CI failed for a synthetically reused transfer reference from previous Phase3AG test; revised fixture uses unique references. Verify latest CODE CI for final results.

## Gates untouched

- No certification: `sourceAttested=false`, `bankCreditVerified=false`, `settlementPosted=false`, `coverageCertified=false`, `canMarkPaid=false`, `canIssueInvoice=false`; existing `writerParticipationComplete=false`.
- Never infer COD payout from Lalamove delivery COMPLETED. Real provider PAID_OUT + independently POSTED bank/Wallet evidence under authorized staging remains blocked.
- No actual immutable source-complete day cutoff, next-day ledger adjustments, tax debit/credit/AR signoff, full Admin SDK migration, 4/8/32 concurrency, two Emulator TODO closures, actual App Check UAT or Finance/Security approval.
- Four release flags FALSE; no candidate Functions exports, real tenant writes, Firebase deploy, or PR merge. Document source review is advisory only.

Key files: `functions/hybrid-billing-demo-batch-reservation.js`, `tests/react-parity/hybrid-billing-firestore-emulator.spec.mjs`, `tests/react-parity/hybrid-billing-phase3ah-ingress-map.spec.mjs`, `functions/delivery-slip.js`, `functions/index.js`, `functions/hybrid-billing-legacy-payment-guard.js`, `docs/HYBRID_BILLING_WRITER_INVENTORY.md`.
