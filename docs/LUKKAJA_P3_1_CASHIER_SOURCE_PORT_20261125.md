# P3.1 — Cashier latest Source JSX and signed Firebase transitions

**25 Nov 2026, Asia/Bangkok. Source READ ONLY:** cosmatch/lukkhaja feature/react-golang-vite-tailwind-axios commit 7bf9d15934f387cd887b46d1b17ca1f2924ffab0. **Target:** Natchanon45/food-order-app feature/react-firebase-port, starting f83c25f8.

## Latest Source rebase

Source CashierPage (1,635 lines) has a compact bill/recipient/status/payment heading, original and edited items, before-discount delivery receipts, Telegram order focus, semantic Lalamove fieldset/action alignment, courier active/uncertain whole-order cancellation lock, re-quote and mandatory renewed fee approval, and paid Takeaway remaining in the cashier queue until physical handover. Target uses Firebase Auth, Firestore and Server Callables rather than the Source Laravel/Go service.

The existing Firebase Cashier had browser writes for payment status, pickup-as-paid, local cancellation and table repairs on page load. Those were removed from the Cashier UI and replaced with three signed, Tenant-scoped Cloud Functions; bank notification or uploaded slip must NEVER become proof of received funds.

## Completed action families (14)

1. Source-styled bill/recipient/date header, separate payment and operational status pills, Firebase billId fallback and mobile badges.
2. Original vs edited order-item quantity/name/amount and original net display (presentation only).
3. Before-discount delivery totals (no trusted order total rewrite).
4. Source semantic Lalamove fieldset, compact mobile action row, cancel-left and primary-actions-right.
5. Client and signed backend lock whole-order cancellation while Lalamove is placing, placed, confirmation_unknown or provider-active.
6. Server-confirmed fresh quote and same-Tenant server order readback before placement; changed quote fee, higher or lower, requires another human approval.
7. Unknown transport/provider booking outcomes never auto-retry; known pre-placement quotation expiry can retry at most once.
8. A paid Takeaway stays in the active Cashier queue until physically picked up.
9. Signed cashierRecordCashReceipt: physically confirmed cash only for single Takeaway or all unpaid rounds of the same Table token, strict uid/Tenant/role, payment type, evidence, state and satang amounts.
10. Atomic server cash update and immutable per-operation cashierActionAudit, with safe idempotent retry after lost response.
11. Signed cashierPickupAction: only already-paid and ready Takeaway; handover never creates paidAt, paymentStatus or bank settlement.
12. Signed cashierCancelOrderSafely: server transaction re-reads current courier reservation, payment evidence and kitchen status. Only untouched unpaid eligible orders may be cancelled, with audit.
13. Source Telegram order focus only within existing signed Tenant orders; disabled page-load auto table/financial repairs while retaining existing bounded courier status fallback.
14. COD remains disabled; historical unsettled COD displays a warning but cannot be acknowledged, backfilled or quoted as a live payment. CompanionCashierReview is evidence-only, never a bank deposit confirmation.

## Eight pseudocode contracts

    AUTH: require signed managed staff and exact Tenant, no public financial mutation
    READ: use realtime orders and tables, no on-mount payment/table repairs
    CASH: require cash-only eligible order(s); verify complete table unpaid set; txn paid + immutable audit
    REPLAY: match operation uid + kind + exact ids; return confirmed existing result, no new audit
    PICKUP: txn signed ready and paid Takeaway; change pickup only, never set payment status
    CANCEL: txn fresh state; forbid slip, bank, kitchen-started, paid, provider-active or unknown booking
    LALAMOVE: new quote, fresh server readback, stop if changed fee; retry only exact pre-placement expiry
    QA: signed Chrome Owner, foreign Owner, Kitchen, cash idempotency/table/pickup, 4 widths, negative review/courier paths

## Acceptance scenarios (18)

1. Bill and payment badge separated and readable on four viewport widths.
2. Source edited-item and delivery-before-discount presentation preserved.
3. Telegram query cannot reveal unauthorized or absent orders.
4. Active courier attempt hides whole-order cancellation.
5. A stale UI cannot bypass signed backend cancellation lock.
6. Changed quotation fee forces renewed human approval.
7. Unknown courier outcome is not automatically retried.
8. Known pre-placement expiry retries at most once.
9. Cash Takeaway requires signed server receipt transaction.
10. Retrying same operation does not create another cash receipt.
11. BankAlert/PromptPay, slip, Stripe and COD are not Cashier cash.
12. Paid Takeaway remains pending physical handover.
13. Unpaid Takeaway cannot be handed over.
14. Handing over does not silently mark an unpaid order paid.
15. Cannot settle just one of two unpaid Table rounds.
16. Two eligible Table rounds settle atomically to their original sum.
17. Server rejects paid, kitchen-started, slip/bank and active Lalamove cancellations.
18. Foreign Owner and Kitchen cannot perform another Tenant's Cashier financial actions.

## Local test receipts / independent external gates

- P3.1 pure Source/financial policy: **8/8 PASS**.
- P3.1 Chrome signed Firebase Auth + Firestore + Functions + Storage Emulator (Owner, foreign Owner, Kitchen and 10 seeded mixed orders): **1/1 PASS**, idempotent cash, full-table atomicity, paid pickup, provider/bank rejection, four responsive widths.
- React Foundation, P0 action contract and all 149 centrally managed Callable definitions: **PASS** after replacing obsolete browser-side direct-write expectations.
- Entire npm run test:react-parity: **EXIT 0, PASS** (all existing serial regressions plus P3.1 contract).
- npm run build:react and generated Hosting Contract: **EXIT 0, PASS**; version 2026.11.09.535; bundle /react/assets/index-CbPKGrba.js. Generated public build files removed.
- node --check on signed Cloud Function modules and git diff --check: **PASS**. P3.1 Emulator temporary config cleaned; no provider network or Production deployment.
- Browser demo calls signed Callables through a DEV-only demo helper, not real physical cash drawer clicks. There are no real bank deposits, Stripe LIVE charges, external LINE notification settlements or Lalamove provider jobs in this acceptance. The live bank/Stripe/LINE receiver and COD gates remain unapproved until independently verified Staging/provider tests. No Production, main merge, APK/IPA, or Source changes.

## Master percentage

Base 65 pinned Source JSX pages. Local Source audit/disposition reaches **10/65 = 15.4%**, still pending **55/65 = 84.6%**, including 7 Cashier/Kitchen/Queue pages. This is conservative local Source acceptance coverage rather than code presence or Production readiness. The old Target already has 52/65 similarly named JSX files (80.0% filename presence).
