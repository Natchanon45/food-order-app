# PENGUIN Firebase — M7 Stripe TEST invoice reservation (no charge)

> **Continuation:** This document describes the quote-only stage at its
> original commit. A newer **dedicated UAT-only Stripe TEST Checkout, signed
> Webhook and non-operational Shadow Settlement Ledger** is implemented in
> `LUKKAJA_P1_M7_STRIPE_TEST_SHADOW_CHECKOUT_WEBHOOK_20261122.md`.
> The financial Invoice Paid/Service Credit writer remains disabled;
> neither milestone authorizes a Production deployment.


**Date:** 2026-11-22
**Source:** `cosmatch/lukkhaja`, `feature/lukkaja_bankalert_stripe`, commit `03d2aaee` (read-only)
**Destination:** `Natchanon45/food-order-app`, `feature/react-firebase-port`
**Deployment:** NOT performed. No real Stripe Checkout, webhook handler, charge, settlement, credit-conversion or production flag was enabled.

## Source gap and intent

Source Go/MariaDB files:
- `bankalert_stripe_m7_reservation.go` — serializable tenant/invoice lock, immutable
  cash-due quote, one active attempt, no blind retry after a provider charge.
- `bankalert_stripe_m7_checkout.go` — *separate* Stripe TEST Checkout issuance,
  with account verification, deterministic provider idempotency, exact
  invoice snapshot and settlement callback conditions.
- `bankalert_stripe_m7_settlement.go` — signed callback **plus independent
  provider re-read** and one transaction which atomically writes payment
  attempt, Stripe settlement, invoice adjustment event, bank-paid cash and
  invoice paid; hold is independently reconciled.
- `bankalert_stripe_m7_evidence.go` — every Stripe settlement requires
  matching immutable reservation, account, amount, intent/session and audit.
- `m7_platform_payment_history.go` — no "verified" without committed bank
  settlement and matching ledger proof.

Firebase already has an isolated **Lalamove Wallet Stripe Sandbox**, but the
existing M7 Hybrid invoices and manual-slip proof writer use a different
financial model; M7 Stripe settlements **must not** piggyback on wallet credit
or silently mark legacy invoice paid. The prior
`LUKKAJA_P1_M7_FINANCE_EVIDENCE_HISTORY_20261122.md` is read-only, not
Stripe-backed.

This milestone ports the Source **non-chargeable reservation stage** and
defines an independent, pure, signed Stripe TEST proof contract. Checkout and
financial posting intentionally remain impossible in this code.

## Files changed

```text
functions/
  m7-stripe-test-reservation-policy.js
  m7-stripe-test-reservation.js
  m7-stripe-test-provider-policy.js
  index.js                        # only quote-readiness + reserve exports
firestore.rules                   # server-only quote locks/reservations
react-app/src/
  components/M7StripeTestReservation.jsx
  ui/m7-stripe-test-reservation.css
  pages/RevenueShareReportPage.jsx
tests/
  firebase-emulator/p1-m7-stripe-reservation.spec.mjs
  react-parity/p1-m7-stripe-test-provider-policy.spec.mjs
  react-parity/p1-m7-stripe-test-reservation-browser.spec.mjs
```

## Quote flow — implemented

```text
Merchant owner/admin (active)
  → getOwnM7StripeTestQuoteReadiness({})
    → exact non-production UAT TEST project + single tenant allowlist
    → server reads up to 31 issued Hybrid invoices (no client amount)
  → user confirms “จองยอดทดสอบ”
  → reserveOwnM7StripeTestInvoice({invoiceId})
    → transaction checks signed-in user + role + tenant + active status
    → re-reads canonical Hybrid invoice id/version/signature/state/amount
    → rechecks original payment attempts and independent invoice adjustments
    → checks per-invoice attempt lock + prior provider closure evidence
    → creates at most one new UUID attempt and invoice lock in one transaction
    → returns {mode:'test',amountSatang,status:'reserved',
               providerCheckoutCreated:false,checkoutEnabled:false,
               settlementEnabled:false}
  → no call to api.stripe.com, no wallet, invoice, credit, hold or bank writer
```

**Canonical source of funds:** existing
`tenants/{tenantId}/hybridBillingInvoices/{invoiceId}` issued by the hybrid
invoice ledger; NOT a new merchant-entered bill. Only
`YYYY-MM-DD:monthly:fixed` and source-compatible Delivery invoice IDs are
supported. Valid invoice amount: whole satang, **10 to 999,999.99 THB**.

**Safe refusal:** missing/changed immutable invoice, amount or kind;
pending/paid manual proof; any pre-existing adjustment (even rejected
historical adjustment, deliberately conservative); paid/pending invoice;
wrong tenant; active quote collision; ambiguous provider/closure status;
25-attempt cap; out-of-range amount. The listing is advisory, while the
transaction is authoritative. Seven concurrent request paths return only
one reservation document and one deterministic invoice lock.

### Project isolation / launch gate

All conditions must hold for the quote surface, and the provider checkout/
settlement flags **must remain unset**:

```text
GCLOUD_PROJECT=<separate named UAT or TEST Firebase project>
PENGUIN_M7_STRIPE_TEST_PROJECT_ID=<the same exact non-production project>
PENGUIN_M7_STRIPE_TEST_TENANT_ID=<one explicit test tenant>
PENGUIN_M7_STRIPE_TEST_RESERVATIONS_ENABLED=1
PENGUIN_M7_STRIPE_TEST_CHECKOUT_ENABLED=0
PENGUIN_M7_STRIPE_TEST_SETTLEMENT_ENABLED=0
```

Default **OFF**. The gate rejects the actual Firebase production project
(`penguin-food`), its known production naming variants, `demo-*`,
Firebase Function/Auth/Firestore Emulator environments, non-matching UAT
project identity, absent one-tenant allowlist, and **any attempt to set
Checkout or Settlement enabled prematurely**. Real production has not been
configured or modified. Tests inject a synthetic gate into the in-memory
function module; the real onCall surface remains disabled in the demo emulator.

Firestore clients cannot read or write the two private collections:
`m7StripeTestInvoiceQuotes` and `m7StripeTestReservations`. Quote
creation does not create any Stripe API resource, save a Checkout URL, or
authorize bank payment; no separate Stripe secret is accessed.

## Future Stripe proof contract — pure code only

`m7-stripe-test-provider-policy.js` has **no callable or onRequest export**:
- Stripe-Signature verified over the exact **raw body bytes**, HMAC-SHA256
  with TEST secret and 300-second clock skew; malformed/oversized bodies
  rejected.
- Only non-live, source-like `checkout.session.completed` or
  `checkout.session.async_payment_succeeded` event types.
- A valid signed event is **only a hint** (`providerVerified:false`);
  independently fetched TEST Checkout Session + PaymentIntent must agree
  on tenant, invoice ID, immutable SHA-256 snapshot, attempt UUID, fee kind,
  exact THB satang, PromptPay-only payment type, client reference ID and
  expected Stripe test account.
- Session must be paid/complete and intent succeeded/fully received,
  both non-live and mapped to the **same** immutable reservation.
- Even a passing pure validator does not post a settlement, alter an
  invoice or unlock a shop: the full transactional accounting writer
  is not yet implemented.

## Acceptance coverage

| Scenario | Result |
|---|---|
| One quote per invoice after 7 concurrent browser tabs | PASS, Firestore Emulator |
| Wrong role, other tenant, inactive owner, wrong invoice ID | PASS |
| Rejected missing invoice, modified satang, altered signature and paid invoice | PASS |
| Manual proof in pending review, adjustment, historical conflict | PASS |
| Fresh quote has no Stripe Session/URL, settlement or invoice Paid | PASS |
| Test project/tenant/explicit flag requirements, live/demo/emulator refused | PASS |
| Same idempotent quote request returns one original attempt | PASS |
| Source session/intent proof: exact amount, metadata, account, test mode | PASS, pure policy |
| Forged webhook HMAC/body/timestamp/currency/metadata cannot pass | PASS, pure policy |
| Merchant UAT UI hidden with no server permission | PASS, Chromium |
| Merchant quote confirmation and unchanged server amount on 4 viewport widths | PASS, Chromium |
| Existing QR/BankAlert/Telegram/M7 history regression tests | Pending consolidated run |
| Real Stripe TEST Checkout, independently re-read provider session/intent | NOT IMPLEMENTED |
| Signed webhook financial transaction and service-credit conversion | NOT IMPLEMENTED |
| Actual dedicated UAT project, bank and Stripe account verification | NOT TESTED |
| Production deployment | NOT PERFORMED |

## Next milestones

1. Add Checkout creation **only after** the checkout session can be atomically
   bound to the original reservation and provider idempotency is established.
   An uncertain provider response must never generate a new attempt.
2. Add independently verified Stripe webhook writer that atomically records
   TEST settlement + intent unique claim + matching canonical invoice event +
   authorized paid state, with robust replay/rollback tests. It must not alter
   the existing Lalamove Wallet Sandbox and must obey Service Credit
   adjustments and existing manual-payment evidence.
3. Add exact Source M7 Stripe settlement history based only on the new
   committed provider proof and verified invoice state, separate from the
   Firestore evidence history, plus authenticated Superadmin reads.
4. Complete and approve UAT with Stripe TEST credentials, real signed
   webhooks, inconsistent amounts, refunds and replay/cross-store scenarios.
5. Only after review, consider staged deployment; no live payments until all
   Source invariants can be proven and the user approves.
