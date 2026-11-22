# PENGUIN Firebase — M7 Stripe TEST Ambiguous Session Recovery

**Date:** 2026-11-22 (Thailand)
**Source (read-only):** `cosmatch/lukkhaja` / `feature/lukkaja_bankalert_stripe` @ `03d2aaee`
**Target:** `Natchanon45/food-order-app` / `feature/react-firebase-port`
**Deployment:** NOT performed. No live credentials/Stripe Test account were contacted; all provider responses were simulated.

## Purpose / boundary

Prior milestone `LUKKAJA_P1_M7_STRIPE_TEST_LIFECYCLE_RISK_AUDIT_20261122.md`
records independently verified paid/expired/failed/refund/dispute TEST evidence.
But a Stripe TEST Checkout Session may be created successfully and then the
HTTP response, Firebase function or local Firestore write may fail.
At that point the immutable M7 invoice reservation is
`provider_requesting`, with no saved `checkoutSessionId`.

**Never re-send Checkout POST with a new attempt** simply because the
original response was lost, and never mark any operational Invoice Paid.

This milestone implements a deliberately supervised *existing-session
reconciliation* that searches Stripe using READ-ONLY queries, binds a unique
eligible Session already on Stripe to the existing invoice attempt, and
writes one immutable audit in the **same Firestore transaction** as
restoring the original TEST Checkout URL. It does not authorize
retrying a payment, issuing refunds or settling real bank cash.

## Source comparison

```text
Source Go: bankalert_stripe_m7_checkout.go
  - source reserves invoice under SQL lock, immutable key/idempotency
  - source refuses to create a fresh payment after an uncertain provider reply
  - source requires verifying original provider response/session

Firebase port:
  - original Firestore invoice reservation + per-invoice lock
  - provider_requesting retains account, idempotency UUID and request timestamp
  - server-side Superadmin review searches TEST Checkout Sessions
  - if exactly one immutable, open, unpaid match:
      ask Superadmin to confirm reattach
      re-scan entire bounded window + independently GET that Session ID
      in one Firestore transaction re-read invoice, lock, attempt,
        original manual payment evidence, adjustments, existing
        TEST settlement, existing recovery audit and Superadmin active role
      atomically append Recovery Audit + reattach same Session ID and URL
  - if paid/expired/failed/no-match/ambiguous/partial:
      refuse reattach, leave provider_requesting for operator review
  - bank cash/credit/invoice Paid/holds/wallet: NO WRITES
```

## Files

```text
functions/
  m7-stripe-test-recovery-policy.js     # TEST Session list paging and exact-match policy
  m7-stripe-test-recovery.js            # Superadmin read-only review + verified transactional bind
  m7-stripe-test-provider-adapter.js    # GET-only allowlisted Stripe session list query
  index.js                              # two new Callables, no browser/provider writer
firestore.rules                         # server-only m7StripeTestRecoveryAudits
react-app/src/
  components/M7StripeTestShadowHistory.jsx
  ui/m7-stripe-test-reservation.css
tests/
  firebase-emulator/p1-m7-stripe-test-recovery.spec.mjs
  react-parity/p1-m7-stripe-test-recovery-policy.spec.mjs
  react-parity/p1-m7-stripe-test-recovery-browser.spec.mjs
package.json                            # npm run test:m7-stripe-shadow includes new cases
```

## Official Stripe API

Stripe documents **List all Checkout Sessions** as
`GET /v1/checkout/sessions`, with creation-time range,
`limit` and `starting_after` cursor pagination:
https://docs.stripe.com/api/checkout/sessions/list

Implementation:
- GET only; Stripe TEST secret, exact non-production TEST Firebase project,
  allowlisted merchant, fixed account and existing reservation.
- Server query `limit=100`, `created[gte]`, `created[lte]`; cursor is
  an internally retrieved `cs_test_...` Session ID.
- Includes a narrow window beginning 120 seconds before the stored
  provider-request timestamp and ending no more than 1 hour after that
  timestamp, capped at the operator's current time.
- Uses at most **5 x 100** returned Sessions; if more sessions remain,
  results are **incomplete** and reattachment is refused.
- Stops searching after **48 hours** from the stored request; absence
  cannot be proved beyond the bounded scan and no retry is enabled.
- Exact TEST-only Session type, amount in satang, currency THB,
  metadata purpose/tenant/invoice/signature/kind/attempt ID,
  client_reference_id UUID, one PromptPay payment method,
  Stripe account and immutable quote must match.
- Scans **all pages** before approving a unique match. Two matching
  Sessions, even if one is valid, produce `ambiguous`.
- A conflicting Session with the same Attempt reference is
  `mismatch`. Zero matches is `not_found_uncertain`, **not**
  `safe_to_retry`.
- A matched Session marked paid, expired or failed is only an
  advisory report; it cannot be reattached as a new Checkout.
- For one open/unpaid Session with no PaymentIntent yet, a Superadmin
  may approve a new GET of its exact ID, then an audited bind.
  The server never POSTs to Stripe as part of recovery.
- Even after successful bind, the original paid-flow still requires
  a separately signed Webhook before Shadow Ledger can record
  `verified_test`. No operational invoice is paid by any of this.

## Roles / Callables

`reviewPlatformM7StripeTestRecovery({tenantId,invoiceId,attemptId})`:
Only active Superadmin; server's exact UAT/test tenant and Stripe TEST
account identity; read-only provider scan; returns sanitized
`status`, counts, existing Session ID only for `single_open`, and
`canCreateNewCheckout:false`.

`bindPlatformM7StripeTestRecovery({tenantId,invoiceId,attemptId,sessionId})`:
Only active Superadmin; separate user confirmation in UI; independently
re-run scan plus GET Session; require same unique Session to remain
open/unpaid; transaction validates the original invoice and no other
manual/adjustment/settlement/recovery, checks Superadmin identity
again, then creates
`tenants/{tenant}/m7StripeTestRecoveryAudits/{attemptId}`
and updates both TEST attempt and invoice lock to
`checkout_ready` in one commit.

The Audit stores only bound IDs, immutable invoice snapshot,
the exact operator UID, original TEST account, review ID and a
`createdStripeSession:false` flag. There is no new Stripe POST.
The Firestore client cannot read or modify it directly.

The merchant's previously implemented `getOwnM7StripeTestCheckoutStatus`
then returns the same safe verified Checkout link once bound.

## Safety acceptance tests

| Scenario | Expected |
|---|---|
| Superadmin reviews two pages and finds one exact Session | single_open; no writes |
| Owner, Cashier, other tenant, inactive Superadmin | denied |
| No Session found in complete bounded scan | not_found_uncertain; **no retry** |
| More than one Session for same Attempt | ambiguous; no bind |
| Incorrect metadata, satang, tenant, live-mode or Session type | mismatch; no bind |
| Bounded scan over five pages or stale request >48h | scan_incomplete; no bind |
| Stripe already shows Paid | wait for signed Webhook; no bind |
| Five concurrent operator bind calls | exactly one audit and one Session bind |
| Manual finance/adjustment state changes before bind | transaction rollback |
| Signed paid Webhook lands before Superadmin bind | operator action refused |
| Signed paid Webhook lands between provider read and transaction | transaction refuses stale state |
| Merchant returns from Stripe success without signed Webhook | never operational Paid |
| 320/390/768/1440px Chrome Superadmin page | two-step modal/UI, no page overflow |
| Real Stripe TEST session reconciliation | **NOT TESTED** |
| Actual Firebase Test project or Production deployment | **NOT PERFORMED** |

## Remaining work

1. **Signed provider-closure verification** for expired/failed sessions,
   reviewed release of the TEST invoice lock, and a new attempt only
   after independently assured provider closure and dual safety checks.
   This milestone intentionally never sets `canRetry:true`.
2. Dedicated isolated Firebase UAT with Test-mode Stripe account,
   real PromptPay TEST payment and signed webhook delivery.
3. Complete operational Source-equivalent M7 invoice financial
   settlement, independent cash bank proof, Service Credit application,
   hold reconciliation and audit ledger. Shadow Settlement cannot
   be used as production invoice Paid.
4. Complete remaining JSX route parity. No Production enablement
   without explicit approval.
