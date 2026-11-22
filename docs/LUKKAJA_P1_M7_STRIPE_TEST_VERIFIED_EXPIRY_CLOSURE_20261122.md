# PENGUIN Firebase — M7 Stripe TEST verified expiry closure and controlled new quote

**Date:** 22 November 2026 (Thailand)
**Source (read-only):** `cosmatch/lukkhaja` / `feature/lukkaja_bankalert_stripe` @ `03d2aaee`
**Target:** `Natchanon45/food-order-app` / `feature/react-firebase-port`
**Delivery:** Commit and Push target branch only; **no Firebase deployment** and no live Stripe/Test-mode account charges were performed.

## Why

The M7 Stripe TEST port now has:
- immutable quote reservation from a canonical Hybrid Invoice;
- a separate, feature-gated TEST Checkout;
- signed Webhook, TEST Shadow Settlement, terminal-unpaid and Refund/Dispute Risk Audits;
- a Superadmin workflow for attaching an existing Checkout after an uncertain provider response.

The previous milestone deliberately kept all expired TEST sessions locked and prevented a new quote. Source's SQL reservation process, however, has a condition for opening the next attempt after a **verified provider closure**. We now implement that condition for the **narrowest safe case only**: a signed TEST `checkout.session.expired` event, independently verified Stripe Session with `status=expired`, `payment_status=unpaid`, and **no PaymentIntent at all**. The provider event and expiration must be at least **30 minutes old**. The original Stripe Session must be the **single exact match** across a complete bounded, paginated search.

A TEST async payment failure `checkout.session.async_payment_failed` is **not sufficient**. Any existing PaymentIntent, uncertain Stripe evidence, incomplete scan, multiple matches, stale original request, bank/manual slip proof, untrusted audit, amount change or previous paid settlement **blocks closure**. We do not generalize retry permissions to other payment modes.

No closure action creates a Stripe Checkout Session. After the Superadmin closes an expired TEST session, an Owner/Admin must **separately click** to reserve a new *non-chargeable* quote, then separately consent to Stripe TEST Checkout if eligible. This is not a payment, refund or financial settlement.

## Files

```text
functions/
  m7-stripe-test-closure-policy.js    # strict terminal event and expiry cooldown checks
  m7-stripe-test-closure.js           # Superadmin review, new independent Stripe GETs, transactional approval
  m7-stripe-test-recovery-policy.js   # reuse bounded Stripe listing; exact old Session ID required for closure
  m7-stripe-test-lifecycle-ledger.js  # repeated signed expiry webhook after new quote is safely acknowledged
  m7-stripe-test-reservation.js       # requires original closure audit before allowing attemptNo + 1
  m7-stripe-test-checkout.js          # merchant private status resolves proof-backed closed state
  m7-stripe-test-shadow-history.js    # platform/private history verifies closure audit before showing closed status
  index.js                            # reviewPlatformM7StripeTestClosure / approvePlatformM7StripeTestClosure
firestore.rules                       # client reads/writes of private Closure Audits forbidden
react-app/src/
  components/M7StripeTestShadowHistory.jsx  # Superadmin review → separate consent → approval
  components/M7StripeTestReservation.jsx    # owner can manually re-quote only after verified closure
tests/
  firebase-emulator/p1-m7-stripe-test-closure.spec.mjs
  react-parity/p1-m7-stripe-test-closure-policy.spec.mjs
  react-parity/p1-m7-stripe-test-closure-browser.spec.mjs
package.json                          # npm run test:m7-stripe-shadow includes closure
```

## Independent provider review and transaction protocol

```
Signed Stripe TEST webhook: checkout.session.expired
  -> signature + timestamp + provider Test event/Session checked
  -> immutable Event claim + tenant Lifecycle Audit
  -> existing TEST attempt and invoice lock: expired_test, closureVerified=false

Superadmin in a dedicated TEST UAT project (not Production):
  -> reviewPlatformM7StripeTestClosure({tenantId,invoiceId,attemptId})
  -> authenticate active Superadmin, exact project/tenant/TEST key and account
  -> read canonical Invoice, quote lock, attempt, event claim, terminal audit,
     absence of TEST Shadow Settlement and previous closure
  -> require original signed expiry event audit from this same attempt
  -> require BOTH terminal audit and Stripe expires_at >=30 minutes old
  -> Stripe GET /v1/account and active PromptPay method configuration
  -> bounded paginated GET /v1/checkout/sessions, all pages
  -> EXACT ONE session matches the original stored Checkout Session ID,
     tenant/invoice/invoiceSignature/kind/attempt UUID, satang and PromptPay
  -> independently GET /v1/checkout/sessions/:id and /v1/events/:eventId
  -> require complete TEST expired/unpaid Session AND no PaymentIntent
  -> return can_review_closure (read-only)
  -> separate Superadmin confirmation

approvePlatformM7StripeTestClosure({tenantId,invoiceId,attemptId}):
  -> repeat the FULL independent provider account/scan/Session/Event reads
  -> Firestore Transaction reads ACTIVE Superadmin/tenant and canonical Invoice
  -> re-read original lock/attempt and signed lifecycle claim/audit,
     manual payment attempts, adjustments, TEST Shadow Settlement
     and existing TEST Closure Audit
  -> require unchanged immutable amount, invoice signature and provider closure
  -> create private Closure Audit (one per old Attempt UUID)
  -> transition the old lock and old Attempt:
       expired_test -> expired
       providerClosureVerified=false -> true
       canRetry remains false; Checkout URL stays empty
  -> no Stripe POST, no new quote, no Paid, no credit/wallet/hold writes

Owner/Admin:
  -> sees proof-backed closed_expired_test state
  -> separate confirmation: reserveOwnM7StripeTestInvoice({invoiceId})
  -> Firestore Transaction re-reads canonical Invoice + original quote lock,
     original Attempt, immutable Closure Audit, original signed Lifecycle
     Audit and Event claim, absence of TEST Shadow Settlement,
     manual payment attempts and pending adjustments
  -> if all match, creates ONE new non-chargeable quote with attemptNo + 1
     and a fresh UUID, preserving original Attempt and both immutable Audits
  -> Stripe TEST Checkout is NOT created by reservation. Requires
     the normal separate owner consent and provider/account validation
```

## Security invariants

- TEST-only project gate rejects `penguin-food` and demo/emulator/non-test projects.
- All real Stripe credentials are Secret Manager values. No keys, bank details or
  test-account secrets are returned to browsers or committed.
- Superadmin's browser never provides the amount, Session ID or refund as
  an authority for closure. The server loads all original proof itself.
- Browser "cancel/success" return URL never marks a payment or releases a lock.
- Event replay after reviewed closure is validated against original immutable
  Lifecycle Audit + Closure Audit, and is acknowledged **without changing the
  new quote lock or creating a second event claim**.
- Invalid/missing Closure Audit is displayed `needs_review`; merchant
  cannot use it to reserve a new quote.
- Stripe PaymentIntent present, even with zero amount_received, is **not**
  sufficient for the new-quote permission in this milestone.
- No approved TEST closure changes the operational Hybrid Invoice Paid flag,
  Service Credit, wallet, bank-cash ledger, kitchen order or tenant access/hold.
- The operator workflow and History are private server Callables, and the
  `tenants/{tenantId}/m7StripeTestClosureAudits/{attemptId}` Firestore
  collection denies direct client access.

## Acceptance scenarios

| Scenario | Result |
|---|---|
| Active signed expiry + matching Event claim + no PaymentIntent | eligible for review |
| 30-minute cooldown from provider expiry and lifecycle audit | enforced |
| Unmatched, duplicate or truncated 500-Session provider scan | no approval |
| Session has PaymentIntent or unexpectedly paid | no approval |
| TEST async failure, no matter whether received amount is 0 | no approval |
| Wrong tenant, role or inactive operator | denied |
| Manual payment proof or pending adjustment | transaction abort |
| Five simultaneous Superadmin approvals | one Closure Audit; one closure |
| Seven simultaneous owner quote requests | one fresh TEST quote; attemptNo +1 |
| Old signed expiry Webhook retried after a new TEST quote | acknowledges old audit, preserves new quote |
| Missing/falsified Closure Audit or invoice changed | no new quote / needs_review |
| Merchant and Superadmin UI on 320/390/768/1440 widths | separate controls and no page overflow |
| Real Stripe TEST funds, Dashboard, or webhook delivery | **NOT TESTED** |
| Firebase Hosting/Functions Production deploy | **NOT PERFORMED** |

## Work remaining

1. Stripe TEST UAT using a **distinct** real Firebase test project, TEST account,
   real TEST PromptPay charge, and signed webhooks. No keys or network request
   to a provider were used during local synthetic tests.
2. The closed-Session procedure intentionally does NOT support Checkout with a
   PaymentIntent (asynchronous failed/canceled), disputes, refunds or
   provider-request uncertainty. Those cases stay under manual investigation.
3. Build Source-equivalent **operational M7 finance ledger** with bank cash,
   applied Service Credit, adjustments, invoice reconciliation and tenant
   suspension recovery before any Production payment/real paid mode.
4. Complete remaining source JSX route parity; any Production deployment needs
   separate explicit authorization.
