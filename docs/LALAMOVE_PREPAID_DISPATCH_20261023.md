# Lalamove central prepaid dispatch: atomic wallet reservation

Updated: 2026-10-23 (Asia/Bangkok). Branch: `feature/react-firebase-port`.

## Why

A paid order's previous dispatch path read the tenant Wallet balance, POSTed
`/v3/orders` to Lalamove, then debited the tenant Wallet. Two concurrent POSTs
could both pass the same non-atomic balance check; a debit error could also leave
a live Lalamove order with no prepaid debit.

The revenue-share report already computes
`platformAmountDue = setting.enabled ? revenueShare : 0`. The field
`lalamoveOutstandingCost` is diagnostic only; prepaid delivery cannot be
converted into a second Platform collection.

## New dispatch lifecycle

1. Obtain/validate the Lalamove quote, customer contact, COD request and
   any required fee-difference approval **without charging the Wallet**.
2. In **one Firestore transaction**, re-read the order, reject an existing order
   or outstanding dispatch reservation, and, for `fod_central`, verify sufficient
   Wallet funds, debit the full quotation fee, create a **reserved** debit ledger
   row, and store `lalamoveDispatchReservation` on the order.
3. Only after the transaction succeeds POST the provider order. Concurrent
   requests cannot place a second order while this reservation exists.
4. On success, atomically persist the provider order, close the reservation,
   stamp the debit on the order, and mark the existing ledger entry `settled`.
   If the final provider fee differs, write an atomic Wallet adjustment: an
   additional debit when sufficient prepaid funds remain, or a credit/refund
   when the provider fee is lower. If an increase exceeds available credit,
   retain the reservation and require manual reconciliation, never a debt.
5. If the provider **definitively rejects** the booking (4xx except 408, 409
   and 429), one transaction restores the Wallet, marks the original debit
   `reversed`, writes an explicit `delivery_refund` credit and removes the lock.
6. If provider status is **ambiguous** (timeout, unknown connection error,
   408/409/429/5xx, invalid accepted response), keep funds reserved, tag the
   order `review_required`, block automatic dispatch retries. A refund is
   **not** assumed until the operator independently verifies that no Lalamove
   order exists or that the provider really refunded.
7. The tenant's own Partner account keeps its own payment responsibility,
   but acquires an order-level lock to block concurrent submissions.

The ledger must retain a historical financial audit trail. Do not delete old
orders or adjust old Wallet balances solely to clear display totals.

## Manual reconciliation

If `lalamoveDispatchReservation.state === "review_required"`, inspect:
- `tenants/{tenantId}/orders/{orderId}` (reservation attempt ID,
  quotation ID, timestamps, `lalamoveOrderId`, last failure)
- `tenants/{tenantId}/lalamoveWalletTransactions/dispatch_{attemptId}`
  (reserved debit)
- Lalamove provider system for the quotation, merchant reference and any
  order or cancellation/refund issued; check provider and Cloud Functions logs.

**Do not manually delete the reservation or credit the wallet without first
confirming the provider's outcome.** There is intentionally no automated
stale-lock expiration: a timed-out HTTP request may already have created a job.

For a historical THB 59 Platform balance, first compare the current
`summary.platformAmountDue` against `summary.revenueShare`, then inspect old
`revenueSharePayments` records and order Wallet stamps. Historical payment
documents are **not** automatically rewritten or deleted by this change.
Actual production data has not been examined in this GitHub-only update.

## Regression coverage

`npm run test:lalamove-prepaid-atomic`: 10 cases, including success/pre-debit,
insufficient balance, same-order concurrent calls, two different orders sharing one Wallet,
definitive rejection and retry,
timeout/unknown outcome, final provider fee increases/decreases, insufficient
additional credit, and independent Partner mode.

Also run `npm run test:lalamove-auto-status`,
`npm run test:revenue-payment-bank-picker`, and Node syntax check.

## Deployment scope

Only `functions/lalamove-dispatch.js` is changed at runtime. Its exported
callable is `placeTenantLalamoveDispatch` (registered in `functions/index.js`).
For a release after validation on the authorized Mac/staging account:

```bash
cd ~/Desktop/Sites/food-order-app
git status --short --branch
git switch feature/react-firebase-port
git pull --ff-only origin feature/react-firebase-port
node --check functions/lalamove-dispatch.js
npm run test:lalamove-prepaid-atomic
npm run test:lalamove-auto-status
npm run test:revenue-payment-bank-picker
firebase deploy --only functions:placeTenantLalamoveDispatch --project chat-45754
```

Hosting does **not** need to be deployed for this backend-only change.
Hybrid Billing registration must remain disabled while its independent
invoice/settlement engine is unfinished; do not deploy other Firebase
functions or Hosting as a side effect of this fix.

This GitHub update does not connect to production Firestore, deploy Firebase,
reconcile historical payments, or issue refunds automatically.
