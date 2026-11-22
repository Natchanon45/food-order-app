# PENGUIN Firebase — M7 Stripe TEST Checkout, signed Webhook and Shadow Settlement Ledger

**Date:** 22 November 2026
**Source (read only):** `cosmatch/lukkhaja` / `feature/lukkaja_bankalert_stripe`, source HEAD `03d2aaee`
**Destination:** `Natchanon45/food-order-app` / `feature/react-firebase-port`
**Deployment:** NOT performed. Stripe requests in acceptance tests are synthetic; no real provider credentials were used, no Stripe account was contacted and no production payment was charged.

## Architectural decision

The original Source Go/MariaDB implementation atomically posts a signed,
independently re-fetched Stripe TEST PromptPay payment into the **operational**
M7 ledger. It simultaneously records the payment attempt, a unique settlement,
invoice adjustment/audit event, verified bank cash, original immutable invoice
and hold reconciliation. A Stripe redirect alone is not proof.

The existing Firebase port does **not yet** contain that complete canonical
M7 bank-cash / applied-Service-Credit / adjustment / hold reconciliation model.
Its Hybrid Billing invoice + manual-slip workflow and separate Lalamove Wallet
Stripe Sandbox must not be silently reclassified or combined with the Source
M7 settlement ledger.

This milestone therefore provides a real **Stripe TEST checkout adapter** and
a signed **Stripe TEST shadow-only settlement writer** behind an explicitly
named, separate Firebase UAT project. Even when a TEST PaymentIntent succeeds,
the production-like operational Hybrid invoice remains unchanged. The shadow
record is an independent record of TEST provider evidence, *not real invoice
payment or bank settlement*. Every user-facing surface makes this explicit.

No provider TEST checkout is issued unless ALL separate UAT credentials and
flags are configured later by an authorized operator. In this development
session every real feature gate was OFF, including the target Production
project. The Emulator tests inject synthetic Stripe responses only.

## Code tree

```
functions/
  m7-stripe-test-reservation-policy.js   # existing non-chargeable invoice quote
  m7-stripe-test-reservation.js          # existing single immutable quote lock
  m7-stripe-test-provider-policy.js      # existing raw signature and Stripe evidence contract
  m7-stripe-test-provider-adapter.js     # new fixed Stripe TEST API transport and Checkout form
  m7-stripe-test-shadow-policy.js        # new project and secrets gates, receipt ingress, URL safety
  m7-stripe-test-shadow-ledger.js        # new TEST-only atomic dedup settlement and intent/event claims
  m7-stripe-test-checkout.js             # new merchant TEST checkout + signed webhook + own status
  m7-stripe-test-shadow-history.js       # new scoped Superadmin TEST shadow evidence reader
  index.js                               # exports the new separately gated Callables/HTTP webhook
firestore.rules                          # deny all browser access to private shadow evidence & claims
react-app/src/
  components/M7StripeTestReservation.jsx # old quote UI + TEST Checkout consent and safe external link
  components/M7StripeTestShadowHistory.jsx # Superadmin shadow evidence display, no Paid label
  pages/AdminTenantsPage.jsx             # separate TEST evidence card after M7 evidence history
  ui/m7-stripe-test-reservation.css       # responsive accessible TEST controls and tables
tests/
  firebase-emulator/p1-m7-stripe-shadow-settlement.spec.mjs
  firebase-emulator/p1-m7-stripe-test-checkout-webhook.spec.mjs
  firebase-emulator/p1-m7-stripe-reservation.spec.mjs (existing/regression)
  react-parity/p1-m7-stripe-shadow-policy.spec.mjs
  react-parity/p1-m7-stripe-shadow-browser.spec.mjs
  react-parity/p1-m7-stripe-test-reservation-browser.spec.mjs (existing/regression)
```

## Source M7 → Firebase M7 TEST mapping

| Source invariant | Firebase implementation | State |
|---|---|---|
| Source tenant/invoice serializable lock | Firestore read-before-write transaction over canonical invoice, per-invoice quote lock, reservation and manual/adjustment proof queries | Implemented |
| Server-derived full cash amount | Exact satang of signed issued/rejected Hybrid invoice, no browser-entered amount, no applied Service Credit | Implemented for currently supported no-credit invoices |
| One active attempt across tabs | Provider-requesting transition under Firestore transaction + deterministic Stripe idempotency key based on immutable UUID | Implemented |
| Check Stripe account/PROMPTPAY | Separate TEST-only Secret Manager key, account ID, non-live/TH country/charges-enabled and enabled PromptPay method | Implemented, actual account not tested |
| Stripe TEST Checkout form | Exact THB total, one PromptPay method, full invoice metadata in BOTH Checkout Session and PaymentIntent, client_reference_id UUID, isolated UAT redirect origin | Implemented, actual Stripe API not contacted |
| Provider uncertainty | If POST fails or result differs, keep provider_requesting and fail closed; never blindly create a second chargeable attempt | Implemented; provider reconciliation UI still pending |
| Signed webhook | Raw body HMAC-SHA256 Stripe-Signature, 300-sec skew, fixed test event types; independent Stripe GET event/session/PaymentIntent | Implemented, synthetic accepted |
| Provider cash confirmation | Independently retrieved TEST Session: completed & paid; TEST intent: succeeded, full received satang; account/metadata/currency/PromptPay match | Implemented in pure policy |
| Double-spend prevention | Global `m7StripeTestIntentClaims/{intentId}`, global `m7StripeTestEventClaims/{eventId}`, tenant one settlement/attempt, atomic transaction | Implemented |
| Replayed webhook | Transaction verifies original settlement and intent claim, returns alreadySettled without another posting | Implemented |
| Original invoice Paid / M7 verified bank cash | **NOT modified:** shadow settlement is deliberately separate and not counted in billing | Blocked pending financial parity |
| Service Credit conversion / bank-paid cash correction | **NOT ported:** existing credit, wallet, hold and invoices remain untouched | Pending |
| Provider expiry, async failure, refund/chargeback follow-up | Unsupported transitions are not paid, remain pending or require operator review; no blind new Checkout | Pending operational completion |

## Explicit environment gates

Quote reservation gate (previous milestone):
```text
GCLOUD_PROJECT=<exact dedicated named test/uat Firebase project>
PENGUIN_M7_STRIPE_TEST_PROJECT_ID=<same exact project>
PENGUIN_M7_STRIPE_TEST_TENANT_ID=<one active test merchant tenant ID>
PENGUIN_M7_STRIPE_TEST_RESERVATIONS_ENABLED=1
```

Additional **TEST Checkout gate**, not enabled here:
```text
PENGUIN_M7_STRIPE_TEST_CHECKOUT_ENABLED=1
PENGUIN_M7_STRIPE_TEST_SHADOW_LEDGER_ENABLED=1
PENGUIN_M7_STRIPE_TEST_SETTLEMENT_ENABLED=0
PENGUIN_M7_STRIPE_LIVE_ENABLED=0
PENGUIN_M7_STRIPE_TEST_ACCOUNT_ID=acct_<Stripe TEST-mode account>
PENGUIN_M7_STRIPE_TEST_RETURN_ORIGIN=https://<the same dedicated UAT project>.web.app
```

Separate Firebase Secret Manager bindings; do not enter values in chat, files,
frontend bundle, Git or test fixture:
```text
PENGUIN_M7_STRIPE_TEST_KEY       # sk_test_... only
PENGUIN_M7_STRIPE_TEST_WEBHOOK   # whsec_... for this TEST endpoint
```

The application rejects `penguin-food`, `penguin-food-prod`,
`penguin-food-production`, demo projects, emulator environments, mismatched
project IDs, non-named UAT/test projects, missing tenant allowlist, wrong return
origin, all live-mode Stripe keys/accounts and attempts to enable the
operational `PENGUIN_M7_STRIPE_TEST_SETTLEMENT_ENABLED` flag.

A distinct `ingressGate` allows signed TEST Webhook receipts to finish when
the TEST Checkout button is turned off, as long as the strictly scoped TEST
shadow ledger remains enabled. A separate `auditGate` retains Superadmin
read-only access to previously committed TEST shadow records even after
Checkout is disabled. Neither can ever activate on Production.

## Merchant flow (UAT only)

```
Owner/Admin → /reports/revenue-share
  → server checks UAT tenant + returns saved canonical invoice eligibility
  → non-chargeable immutable quote reservation (see earlier milestone)
  → private Checkout status reads test reservations only
  → owner confirms: test-mode charge, NOT operational invoice payment
  → fresh TEST account + PromptPay verification (before provider-requesting lock)
  → Firestore transaction: active user/tenant + unchanged quote/lock
      + absent other manual attempts/adjustments
      + state reserved → provider_requesting
  → Stripe POST /v1/checkout/sessions
      Idempotency-Key: penguin-m7-test-<immutable reservation UUID>
      deterministic session/intent metadata and exact satang
      redirect URL points to dedicated Firebase UAT project
  → verify returned TEST session/amount/currency/metadata/URL
  → Firestore transaction: provider_requesting → checkout_ready
  → show a separate external HTTPS Stripe TEST link
  → on return / report refresh: do NOT infer Paid
```

The server never forwards arbitrary URLs, endpoints or custom amounts.
The React client validates its returned `checkoutUrl` against
`https://checkout.stripe.com/(c|g)/pay/...`; no auto-redirect is made on
reservation. It never trusts URL query, local Browser state, image or Stripe
success page to mark Paid. A network timeout leaves `provider_requesting`
requiring operator inspection; no automatic second POST.

## Signed Webhook → Shadow Ledger only

```
Stripe TEST webhook POST (separate secret and endpoint)
  → raw Stripe-Signature and timestamp verified
  → allow TEST paid session events only
  → independently GET /events/<id> using sk_test key
  → compare event type, session ID, tenant, invoice and reservation UUID
  → independently GET /checkout/sessions/<id> and /payment_intents/<id>
  → compare TEST/livemode=false, completed, succeeded, THB satang,
      PromptPay-only, current exact TEST account,
      reservation UUID, tenant/invoice/snapshot metadata
  → Firestore transaction reads canonical invoice, lock, reservation,
      manual-slip attempts, pending adjustments, TEST settlement,
      global intent/event claims
  → conflict? fail closed, require review
  → first valid proof? atomically create:
      m7StripeTestIntentClaims/<intent-id>
      m7StripeTestEventClaims/<event-id>
      tenants/<tenant>/m7StripeTestSettlements/<attempt-id>
      update original TEST reservation and quote lock to verified_test
  → replay? same settlement/intent/amount → alreadySettled
  → operational Hybrid invoice/period/hold/Service Credit/wallet/order:
      NO WRITES
```

Webhook events which do not prove complete TEST payment do not settle an
invoice. Unhandled expired/failed/refunded/disputed events must be reconciled
before any future invoice-Paid integration.

## Browser and back-office privacy

- Merchant sees the quote section only if its server-gated feature is
  available. A second confirmation is required for TEST Checkout. A verified
  provider TEST result displays as **Stripe TEST confirmed in Shadow Ledger —
  invoice not Paid**, not as a bank-paid invoice.
- Superadmin sees a separate collapsed **Shadow Ledger** registry only after
  selecting an exact tenant. The history compares each attempt with its
  immutable settlement proof and downgrades inconsistent/missing proof to
  `needs_review`. No Stripe link or secret appears in the platform history.
- Browser cannot create/edit/read any private invoice quote lock, TEST
  reservation, TEST settlement, global Event/Intent claim. Firestore Rules
  deny all direct access. Only authenticated scoped Callables and the signed
  server webhook can inspect/write.
- No raw Stripe response, test secret, payer details, full account, slip,
  bank raw notification or private finance review is returned in the UI.

## Acceptance scenarios

| # | Scenario | Evidence |
|---|---|---|
| 1 | Original non-chargeable 7-tab quote still produces one attempt | Firestore Emulator |
| 2 | New TEST Checkout 2-tab race posts at most one provider session | Firestore Emulator (synthetic Stripe transport) |
| 3 | One immutable invoice-derived satang + metadata in Session and Intent | Provider adapter/test |
| 4 | Separate TEST-only account/PromptPay check and UAT return origin | Pure policy |
| 5 | Wrong role, tenant, changed invoice, pending manual evidence blocked | Firestore Emulator |
| 6 | Provider "requesting" cannot be reissued with a new charge | Firestore Emulator |
| 7 | Signed raw webhook validates HMAC, clock and allowlisted event kind | Pure policy + HTTP integration |
| 8 | Independent TEST GET event/session/intent rejects forged payout | Firestore Emulator fake remote source |
| 9 | 5-7 simultaneous webhook callbacks create one TEST shadow settlement | Firestore Emulator |
| 10 | Same intent reused across a different invoice is globally blocked | Emulator cross-test collision / global claim |
| 11 | Replayed event produces alreadySettled, no new cash/wallet record | Firestore Emulator |
| 12 | Paid bank invoice, manual attempt or adjustment blocks shadow writer | Firestore Emulator |
| 13 | Operational invoice remains Issued and not marked Paid | Firestore Emulator |
| 14 | UAT Checkout off, signed webhook still accepted in configured TEST ingress | Pure gate policy |
| 15 | Superadmin TEST audit read remains scoped when Checkout off | Pure gate policy |
| 16 | Missing/tampered proof becomes needs_review, never verified | Pure history policy |
| 17 | Merchant and platform tested at 320, 390, 768, 1440px | Chromium mocked browser |
| 18 | Existing BankAlert, Telegram, M7 history, and revenue reports intact | Consolidated regressions |
| 19 | Real Stripe TEST account, test QR charge and actual Stripe webhook | **NOT TESTED** |
| 20 | Refund, expiry, cancellation, provider timeout reinspection workflow | **NOT COMPLETED** |
| 21 | Real M7 cash settlement + Service Credit conversion | **NOT IMPLEMENTED** |
| 22 | Production, live Stripe or Firebase Hosting deployment | **NOT PERFORMED** |

## Known limitations and next milestones

1. Stripe TEST Checkout can technically issue a provider test session *only
   when operators configure an isolated UAT environment*. This turn
   implemented and tested a synthetic provider adapter, **not** a real
   Stripe transaction.
2. There is no authenticated operator workflow yet to reconcile an ambiguous
   provider-requesting attempt, mark Stripe-confirmed session expiry,
   authorize a new reservation, track asynchronous failure, refund or
   chargeback. Refuse blind retry to prevent double charging, even TEST.
3. Do not derive operational payment status from Shadow Ledger. Complete
   Source's immutable invoice cash, beneficiary bank, credit-applied, adjustment
   and access-recovery audit and prove atomic rollback before adding a
   separate reviewed financial posting writer.
4. Add live-like UAT for both Owner and Superadmin with a dedicated Firebase
   TEST project, Stripe TEST mode account, signed webhook, real account
   statements, partial-credit and conflicting manual evidence. Test the
   browser success and canceled returns as non-payment evidence.
5. Continue source JSX parity on remaining Superadmin finance and merchant
   operational pages; do not deploy Production without explicit approval.
