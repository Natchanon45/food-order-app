# P3.2 — Kitchen latest Source JSX and Firebase signed order transitions

**Date:** 25 Nov 2026, Asia/Bangkok
**Pinned Source READ ONLY:** cosmatch/lukkhaja, feature/react-golang-vite-tailwind-axios, commit 7bf9d15934f387cd887b46d1b17ca1f2924ffab0
**Target:** Natchanon45/food-order-app, feature/react-firebase-port, initial baseline da96f048f9b48ebd9e5a4b9b5d8ee45a228af30f
**Scope:** P3.2 Kitchen source parity and signed Firebase operations. **NOT** confirmation of an actual bank deposit, refund, live courier booking or Production deployment.

## Source comparison

The pinned Source KitchenPage contains 683 JSX lines with a responsive delivery bill/recipient/payment/status header, historical original-vs-edited line items/net, delivery-fee and discount breakdown, Telegram order focus, a semantics-preserving edit/delete/status layout, paid cancellation with audit and explicit server delivery admission/courier-state guards.

The Firebase target had similar basic cards and existing deferred Walk-in transaction APIs. However normal Table/Takeaway/Delivery edits, cancellations and Kitchen status changes previously updated Firestore directly from the React client. It also triggered automatic Table settlement and courier status repairs on page open. P3.2 replaces those non-Walk-in mutations with signed Firestore transactions, while **retaining** the previously tested deferred Walk-in/paid Walk-in review Callables and bounded Lalamove status-only refresh.

## Completed action families (15)

1. Source responsive staff delivery header: real bill number, recipient, displayed status, payment badge and time; scoped CSS shared in style only with Cashier, no global kitchen/cashier collisions.
2. Original quantity/name/amount and net-history display using existing immutable Source presentation helpers, never inferred as a refund.
3. Source delivery subtotal, delivery fee, amount before discount and discount rows retained, while the trusted paid amount remains separate.
4. Source semantic edit, cancel-item, cancel-order and status controls with mobile-safe button spacing and the existing Bootstrap icons; signed operation feedback only.
5. Telegram order focus uses only authorized existing Kitchen queue IDs, not new broad read privileges.
6. Source paid/unpaid and pending-verification payment badges, with existing explicit limited merchant-risk release warning and no conversion into a paid claim.
7. COD remains disabled for Kitchen admission; legacy unsettled COD remains a Cashier/provider reconciliation matter.
8. Signed kitchenApplyOrderAction checks Firebase Auth, canonical active Tenant, Owner/Admin/Kitchen role, the exact current order, expected status, expected payment status, and monotonically increasing revision; suspended shops are rejected.
9. Immutable per-operation kitchenActionAudit and stable retry operation IDs. Duplicate/lost-response retries do not replay a Kitchen mutation. Concurrent Kitchen/Cashier state changes are rejected.
10. Menu edit uses the **canonical Tenant menu document and active/price validation** inside a transaction, not browser-provided item price; changed quantities/menus require an explanatory note.
11. Item cancellation and recalculated totals use finite integer satang and bounded delivery discount, and preserve original edited-item display history.
12. On already paid items, preserve original totalAmount, paidAt, paymentStatus, paid bank evidence and revenue-share basis; store a separate kitchenRevisedTotals and kitchenFinanceReviewRequired without asserting refund or adjusting bank collection.
13. Paid order cancellation remains auditable without destroying the original payment record. Any financial reversal remains an explicit independent cashier/finance review, not an automatic refund.
14. Lalamove reservation **before** provider POST, active/uncertain job and wallet debit pending block Kitchen edits/cancellation even without a courier job ID. A definitively canceled/rejected/expired courier job unlocks normal Kitchen editing **only when no newer reservation exists**, matching the pinned Source.
15. Opening Kitchen is read-only: no automatic Table settlement or courier-order financial mutation. Signed final Table serving or full cancellation can then invoke pre-existing signed settleTableSession, releasing the table only after all rounds are closed.

## Eight pseudocode paths

    AUTH:
      signed managed Firebase Auth -> canonical role + Tenant; no cross-Tenant writes
      Kitchen staff cannot update order directly via Firestore client rules

    READ:
      realtime orders + tenant menus
      if either read fails show error; never keep stale actionable ticket
      refresh provider status only through bounded existing callable

    STATUS:
      client sends expected revision/status/payment and stable operation ID
      server transaction reloads current state + audit + Tenant
      validate Kitchen admission, courier lock and ordered status progression
      mark served only for self-delivery/Table/Takeaway; never mark paidAt

    EDIT:
      transaction reloads original order and Tenant active menu document
      required explanation, integer quantity, canonical server price
      record originalQty/originalName/originalLineTotal for display
      if already paid, leave paid ledger untouched and flag manual review
      else update checked 2-decimal subtotal/delivery discount/total

    CANCEL_ITEM:
      server checks original item, served/dispatch lock and revision
      cancel item and audit; last item cancels only eligible order
      paid receipt remains immutable and requires separate finance review

    CANCEL_ORDER:
      signed transaction rejects courier reserved/unknown, paid-closed or unadmitted
      mark cancel and actor; paid value still in canonical ledger
      never infer or issue refund

    WALKIN:
      keep preexisting signed deferred Walk-in Kitchen and paid-review APIs
      no invented unsigned item editing for paid Walk-in

    QA:
      8 pure policy/source contracts
      real signed Auth+Firestore+Functions Chrome with Kitchen/Owner/foreign Kitchen/Cashier
      duplicate/replayed operations, edited menu, paid ledger, backend cancel guard
      check 320/390/768/1440 and direct Firestore write denial
      full serial React Parity, React build, source unchanged

## Acceptance scenarios (19)

1. Kitchen bill, payment and status header fits four browser widths.
2. Historical revision and delivery discount visible, not a new bank receipt.
3. A COD Delivery does not silently enter Kitchen.
4. Unverified PromptPay with slip cannot be advanced into cooking.
5. An explicit narrowly scoped merchant-risk release may enter Kitchen but remains unpaid.
6. A reservation created before Lalamove POST blocks local cancellation.
7. An existing Lalamove job blocks Kitchen cancellation and item changes.
8. Kitchen pending -> accepted -> cooking -> ready follows the exact order.
9. Replaying a signed status operation returns existing audit result.
10. A stale independent action is rejected by revision and expected status/payment.
11. Only a ready and unserved Table item can be served.
12. Signed final item serving does not fabricate receipt or paidAt.
13. Edited item uses the currently active canonical store menu and not tampered browser price.
14. An unpaid order adjusts total with original amount history preserved.
15. A paid edit keeps original payment amount, creates proposed revised totals and manual finance review flag.
16. Paid cancellation remains audited with original receipt, without automatic refund.
17. Foreign Tenant, Cashier-role impersonation and direct browser Firestore Kitchen writes are denied.
18. After the final cancelled Table round, the existing signed table-settlement transaction releases the occupied table; no page-load repair is required.
19. A definitively canceled/rejected/expired Lalamove job permits Kitchen editing only when there is no new or uncertain reservation.

## Local test receipts and gates

- P3.2 pure Source/financial/courier policy contract: **8/8 PASS**.
- Signed Chrome + real Firebase Auth/Firestore/Functions/Storage Emulator: **1/1 PASS**, tested Kitchen, Owner, Cashier and another Tenant with nine seeded order types, real menu price, idempotency, courier reservation, paid ledger, and four responsive widths.
- Existing Kitchen Lalamove lock, Delivery Kitchen gate, React Foundation and P0 contracts: **PASS** after updating obsolete direct-browser-write/COD expectations.
- Complete npm run test:react-parity **PASS Exit 0**; npm run build:react and generated Hosting Contract **PASS Exit 0** (2026.11.09.535, bundle /react/assets/index-D2gHJ-Qo.js). Generated public assets and Emulator temp config cleaned.
- No external LIVE bank, Stripe, LINE BankAlert, customer payment, Lalamove POST, refunds or Production operations were invoked. Emulator is not external provider certification. Paid Kitchen financial adjustments remain **pending explicit cashier reconciliation**; do not infer payout/refund completion.
- Source repository/branch is read-only. No main merge, Production/Staging deployment, APK or IPA.

## Master JSX accounting

Pinned Source total **65 JSX pages**; after P3.2 **11/65 = 16.9%** Source-page acceptance or explicit disposition in Local and **54/65 = 83.1%** remaining formal review. This is audit acceptance coverage, **not** code completion or Production readiness. Existing filename overlap is 52/65 but not proof of functional parity.
