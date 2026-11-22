# PENGUIN Firebase — M7 Stripe TEST Lifecycle, Safe Inspection and Risk Audit

> **Continuation:** Superadmin-only recovery of a previously created but
> unrecorded Stripe TEST Checkout Session is documented in
> `LUKKAJA_P1_M7_STRIPE_TEST_AMBIGUOUS_SESSION_RECOVERY_20261122.md`.
> The recovery workflow never sends another Stripe POST and never posts
> operational Invoice Paid or Service Credit.

**Date:** 22 Nov 2026 (Thailand)
**Source (read-only):** cosmatch/lukkhaja / feature/lukkaja_bankalert_stripe @ 03d2aaee
**Target:** Natchanon45/food-order-app / feature/react-firebase-port
**Status:** Implemented and locally tested with synthetic provider responses. **Not deployed.**

## Why this milestone exists

The preceding milestone
`LUKKAJA_P1_M7_STRIPE_TEST_SHADOW_CHECKOUT_WEBHOOK_20261122.md`
introduced immutable Invoice TEST reservations, gated TEST Checkout,
independent Stripe event/session/intent reads, an exactly-once TEST
shadow settlement, and read-only merchant/Superadmin history. It did
**not** handle session expiry, asynchronous failed payments,
refund/dispute evidence, or merchant provider-state inspection.

A Browser cancel/success redirect is *never* payment proof. A failed
provider request may have reached Stripe. An expired or failed TEST
session may be inspected, but must not unlock a new chargeable attempt
without reviewed closure. A refunded TEST payment cannot continue to
look cleanly "verified" in history. None of these test states may
change Hybrid Invoice Paid, bank cash, Service Credit, delivery,
kitchen, access/hold or wallet accounting.

## Changes

```text
functions/
  m7-stripe-test-lifecycle-policy.js      # signed terminal-event + independent terminal-unpaid check
  m7-stripe-test-lifecycle-ledger.js      # terminal-unpaid audit & immutable locked status
  m7-stripe-test-risk-policy.js           # signed Stripe TEST refund/dispute evidence binding
  m7-stripe-test-risk-ledger.js           # idempotent post-settlement risk audit
  m7-stripe-test-provider-adapter.js      # readonly GET /charges/:id and /disputes/:id allowlisted
  m7-stripe-test-checkout.js              # terminal/risk webhook routes + merchant read-only inspect
  m7-stripe-test-shadow-history.js        # proof-checked terminal/risk status downgrade
  index.js                                # exports inspectOwnM7StripeTestCheckout callable
firestore.rules                           # server-only lifecycle/risk audit collections
react-app/src/
  components/M7StripeTestReservation.jsx # read-only inspect + explicit TEST states, no blind retry
  components/M7StripeTestShadowHistory.jsx # separate Superadmin TEST terminal/risk statuses
  ui/m7-stripe-test-reservation.css
package.json                              # repeatable npm run test:m7-stripe-shadow
tests/
  firebase-emulator/p1-m7-stripe-test-lifecycle.spec.mjs
  firebase-emulator/p1-m7-stripe-test-risk.spec.mjs
  react-parity/p1-m7-stripe-test-lifecycle-policy.spec.mjs
  react-parity/p1-m7-stripe-test-risk-policy.spec.mjs
  react-parity/p1-m7-stripe-test-lifecycle-browser.spec.mjs
```

## 1. Source parity: terminal-unpaid lifecycle

Signed Stripe TEST events:
- `checkout.session.expired` — independently retrieved Session must be
  TEST-only, exact saved Session or original request UUID, THB/amount
  and PromptPay metadata, status **expired**, payment_status **unpaid**.
  If an intent exists, it must show zero received funds and an allowed
  non-successful state.
- `checkout.session.async_payment_failed` — independently retrieved
  Session must be **complete** but payment_status **unpaid**; linked
  intent, when present, must have zero funds received and failed or
  canceled state.

Flow:
```
verify raw Stripe-Signature over bytes and <=300s skew
  -> independently GET Stripe TEST event
  -> independently GET saved Session and optional PaymentIntent
  -> validate exact tenant/invoice/attempt/immutable signature/account/satang
  -> Firestore transaction reads canonical Hybrid Invoice, TEST reservation,
     invoice quote lock, manual payment attempts, adjustments,
     prior shadow settlement, global TEST event claim and lifecycle audit
  -> only if unpaid proof is conclusive and Invoice remains payable:
      create global event claim and tenant lifecycle audit
      transition both reservation + lock to expired_test or payment_failed_test
      blank hosted Checkout URL, set providerClosureVerified=false, canRetry=false
  -> replay validated by exact claim + audit + current locked state
  -> NO operational finance/Invoice/credit/hold writes
```

Two important tradeoffs:
1. The independent provider check *does not* release the lock or
   authorize a new Checkout. Even terminal-unpaid proof may coexist
   with a delayed payment/reversal event; retry requires a future
   separately reviewed provider-closure workflow.
2. Session inspection is a **read-only Callable**
   `inspectOwnM7StripeTestCheckout({invoiceId})`, authenticated to the
   active merchant Owner/Admin of the explicitly enabled UAT tenant.
   It never interprets a return URL as paid and never writes financial
   records. State `awaiting_signed_webhook` is **not** Paid.

## 2. Post-payment Refund / Dispute Risk Audit

Signed TEST events:
- `charge.refunded` (partial or full, `amount_refunded > 0`)
- `charge.dispute.created` (the dispute must reference the retrieved charge)

Flow:
```
verify raw Stripe-Signature and TEST event type
  -> independently GET Stripe TEST event object
  -> independently GET TEST charge or TEST dispute + charge
  -> validate refund/disputed amount, non-live currency/ids
  -> resolve PaymentIntent via global M7 TEST intent claim
  -> independently GET original TEST Checkout Session and PaymentIntent
  -> re-validate immutable session/intent/Invoice snapshot and account
  -> Firestore transaction checks original TEST settlement,
     intent claim, reservation, quote lock and unique event claim
  -> create global TEST event claim and separate tenant Risk Audit
  -> mark TEST attempt's risk status with latest audited event:
       refund_review or dispute_review
  -> immutable original Shadow Settlement remains as historical proof,
     but customer-facing TEST history is downgraded to
       provider_test_refund_review or provider_test_dispute_review
  -> incomplete/mismatched risk audit displays needs_review
  -> NEVER auto-issue a Stripe Refund/chargeback response,
     reverse platform cash, change Invoice Paid or Service Credit
```

This is *evidence intake and escalation*, not an automated refund,
dispute-management or operational finance system. Multiple risk events
remain as separate immutable audits; the latest one is highlighted.
Refund totals and dispute outcomes still require further review, and
the fact of a historical successful TEST charge is retained.
There is no direct API path to POST Stripe refunds/disputes.

## 3. Data isolation and security

Server-only Firestore paths:
```text
tenants/{tenantId}/m7StripeTestLifecycleAudits/{eventId}
tenants/{tenantId}/m7StripeTestRiskAudits/{eventId}
m7StripeTestEventClaims/{eventId}           # shared idempotency across paid + terminal + risk
m7StripeTestIntentClaims/{intentId}         # intent globally bound to one M7 TEST attempt
```

All direct client reads/writes to the new collections are denied.
The signed webhook can only work in the dedicated UAT/test project
with exact merchant allowlist, distinct `sk_test_` key and
`whsec_` secret, TEST account and **operational settlement OFF**.
The separate ingress gate continues receiving signed TEST receipts if
new Checkout issuance has been disabled, avoiding stranded events.
The Merchant and Superadmin read paths return sanitized statuses only.
No client can pass a Stripe amount, account, Session, Intent, refund,
dispute or event as the authority for a finance mutation.

The proof-history contract remains strict:
- Missing/mismatched terminal audit => `needs_review`.
- Missing/mismatched refund/dispute audit => `needs_review`.
- Proven Refund/Dispute => explicit `*_review` status,
  **not** `provider_test_verified`.
- All rows remain `operationalSettlementEnabled=false`;
  Test evidence cannot mark the operational Invoice Paid.
- Up to 50 past TEST reservations per selected tenant in
  read-only Superadmin history; no all-tenant raw scan.

## 4. Acceptance cases

| Scenario | Expected |
|---|---|
| Six concurrent signed expiry webhooks | Exactly one lifecycle audit and event claim |
| Invalid HMAC / stale timestamp / forged paid session | No terminal confirmation |
| Async payment failure + independent zero-received intent | One payment_failed_test audit |
| Delayed paid event after terminal state | No operational Paid or unsafe retry |
| Inspector sees open session | awaiting_payment, read-only |
| Inspector sees provider success before signed paid webhook | awaiting_signed_webhook, not Paid |
| Inspector sees expired or failed from provider | advisory status, canRetry=false |
| Session expired/failed and user returns to merchant | no new Checkout button |
| Six concurrent signed partial refund webhooks | Exactly one risk audit, no wallet/Invoice writes |
| Dispute follows Refund | both audit events retained, latest risk visible |
| Replayed same risk/terminal event | no double ledger mutation |
| Invalid or unlinked PaymentIntent / charge | risk event rejected |
| Stripe refund via POST endpoint | not supported / rejected by allowlist |
| Verified TEST settlement followed by Risk Audit | Superadmin status downgraded |
| Missing/adulterated risk audit | needs_review, never silently verified |
| Merchant vs cashier vs Superadmin access | strict per-role/tenant scope |
| Browser widths 320/390/768/1440 | no horizontal page overflow |
| Real Stripe account or signed real provider webhook | **NOT TESTED** |
| Production deploy | **NOT PERFORMED** |

## 5. Next work remaining

- **True Stripe TEST UAT:** Dedicated Firebase UAT project, authorized
  test Stripe account, physically complete a TEST PromptPay QR and
  inspect signed webhook delivery and provider history. No such
  credentials or account were provided or used in this session.
- **Provider-request-uncertain recovery:** If the Checkout request
  returns ambiguously before a Session ID was persisted, keep
  `provider_requesting` and require a tested operator procedure
  to retrieve/verify the original provider Session. Never issue a
  second POST blindly.
- **Reviewed post-expiry attempt restart:** Requires independent
  provider-closure attestation plus an explicit operator decision.
  This milestone never sets `providerClosureVerified=true`.
- **Refund/Dispute workflow:** Actual refunds, dispute resolution,
  partial refund reconciliation and collection-bank transfer/fees
  remain outside this Shadow Ledger.
- **True operational M7 finance:** Source-equivalent bank cash +
  Service Credit + adjustments + hold enforcement and rollback,
  then explicitly approved full end-to-end testing prior to release.
- **Source JSX parity:** More Superadmin and merchant finance pages
  remain to port; this milestone focuses only on TEST lifecycle
  correctness rather than unrelated UI duplication.
