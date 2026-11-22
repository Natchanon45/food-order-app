# PENGUIN Firebase — M7 operational Cash / Service Credit source parity: pure policy + Superadmin gap review

**Date:** 22 Nov 2026 (Thailand)
**Source read-only:** `cosmatch/lukkhaja`, branch `feature/lukkaja_bankalert_stripe` @ `03d2aaee`
**Target:** `Natchanon45/food-order-app`, branch `feature/react-firebase-port`
**Deployment:** Not deployed. All financial and provider integrations remain OFF.

## Source audit and high-confidence findings

Source operational M7 is not a single `invoice.status === "paid"` flag.
The source relational ledger is distributed across:
- `merchant_platform_invoice_journal`: immutable source and invoice snapshot,
  invoice type (monthly, yearly, delivery_daily), gross cents,
  applied Service Credit, independently verified bank-paid cents, state.
- `merchant_platform_payment_attempts` and `merchant_platform_invoice_adjustment_events`:
  one trusted bank/source payment and a specific approved, auditable outcome.
- `merchant_service_credit_accounts`, `merchant_service_credit_events`,
  `merchant_service_credit_conversions`: cumulative integer-satang
  liabilities, source conversion evidence and append-only offsets/reversals.
- `merchant_m7_hold_policy_approvals`,
  `merchant_payment_obligation_holds`,
  `merchant_payment_hold_events`: signed approval and a separate
  financial-hold lifecycle, not an arbitrary subscription status toggle.

Relevant canonical Go modules:
```text
goapi/cmd/web/merchant_service_credit_policy.go
goapi/cmd/web/merchant_service_credit_reclassification.go
goapi/cmd/web/m7_operational_service_credit.go
goapi/cmd/web/m7_operational_monthly_prepay.go
goapi/cmd/web/bankalert_stripe_m7_settlement.go
goapi/cmd/web/m7_operational_hold_approval.go
goapi/cmd/web/merchant_payment_access_policy.go
goapi/cmd/web/revenue_share_delivery_policy.go
```

**Critical**: Source Go's `maxSourceSafeCents` is
`9007199254740991` (`Number.MAX_SAFE_INTEGER`). Source's
`paid by bank` is linked to bank/payment evidence that Firebase
has **not** migrated. Stripe TEST's `m7StripeTestSettlements` is an
intentionally non-operational Shadow Ledger. Neither a paid Firestore
status nor a TEST payment may become a Source-equivalent bank receipt.

### Current JSX audit

At this milestone (counts from the Mac mini's tracked Source directory
and working Target directory, not a feature-completion score):

| Tree | JSX files | Lines |
|---|---:|---:|
| Source primary `resources/js/react-port/` | **154** | **48,500** |
| Target `react-app/src/` including this milestone | **101** | **36,346** |

Source also contains separate reference/pilot trees which are not
included in these primary JSX counts. Migrations may consolidate or
split files; line-count ratios do **not** represent functional parity.

## This milestone

### 1. Pure, Source-based integer-satang credit policy (NO writer)

`functions/m7-operational-credit-policy.js`

Ports the following Go behavior as **pure functions** with no Admin
Firestore, Stripe, bank or Cloud Function invocation:
- `chooseBilling`: monthly/yearly, one-month trial, strict
  threshold (`paidGoodsCents > thresholdCents`, not `>=`),
  monthly waived once the delivery threshold is crossed.
- `balance`: replay append-only grants, daily offsets, monthly
  offsets and verified monthly reversals, with unique source/target,
  cycle, type, amount and non-negative balance constraints.
- `convertMonthly`: convert an **already verified**, formerly paid
  monthly fee into Service Credit only after crossing the original
  delivery threshold. Yearly is never converted.
- `applyOffset`: apply the available credit to an immutable issued
  delivery-daily or monthly-renewal invoice BEFORE a bank transfer is
  requested; never apply to yearly membership, tentative estimates
  or Lalamove Wallet. Repeated exact invoice offset is idempotent.
- `reclassifyMonthly`: when a monthly fee was paid partly with prior
  credit and partly with verified bank money, restore both parts
  using an atomic-sequence *proposal*. Missing partial posting,
  wrong original monthly invoice or uncertified bank funds reject.
- `carryForward`: reads the balance; never mints new credit.
- `invoiceResidual`: gross − applied credit − verified bank funds;
  no credit against yearly, and paid/settled_credit requires zero residual.

**These are deterministic, non-authoritative calculations.**
Their `bankPaymentVerified`, `invoiceCertified` and
`approvedPriceSnapshot` boolean inputs are fixtures/interfaces,
**not security authorization from a request or a bank**. None is
exposed as a payment/credit mutation Cloud Function.

### 2. Source-to-Firebase finance readiness (server-read-only)

`functions/m7-operational-readiness-policy.js`
`functions/m7-operational-finance-readiness.js`

New Superadmin-only Callable:
`getPlatformM7OperationalFinanceReadiness({tenantId})`.

It is gated by the same exact private **Stripe TEST UAT project and
tenant** allowlist. No keys are passed to clients, no bank request is
made, and the Callable does **not** enable Stripe Checkout or writing.

Server reads only:
```text
users/{superadminUid}                          # active role super_admin
tenants/{selectedTenantId}
tenants/{tenantId}/hybridBillingInvoices       # last 30, 31st detects more
tenants/{tenantId}/hybridBillingPaymentAttempts # first 200, 201st detects more
tenants/{tenantId}/hybridBillingPaymentEvents   # joined explicit paid candidates only
tenants/{tenantId}/hybridBillingAdjustments      # first 200, 201st detects more
tenants/{tenantId}/m7StripeTestReservations     # first 200, 201st detects more
```

Builds an allowlisted, sanitized **gap worklist** per canonical invoice:
- `grossCentsFromFirebase`: locally issued amount, **not** a
  Source-certified immutable M7 bank-collection obligation.
- `firebaseRecordedOnlyCents`: strictly matching previously
  Superadmin-reviewed Firestore documents, **not** source/independent
  bank-cash proof.
- `sourceBankVerifiedCents`, `sourceCreditBalanceCents`,
  `sourceServiceCreditAppliedCents`, `remainingBankCashDueCents`:
  **null** until original source journals, credit conversion proofs
  and independent bank authority are actually migrated.
  Missing money is not silently reported as 0.00 baht.
- Missing source M7 invoice journal, bank journal, signed hold approval,
  closed delivery-threshold proof and service-credit account/events
  are **always blockers**.
- Pending review/slips, multiple attempts, adjustments, separate
  suspension, Stripe TEST Shadow evidence or truncated scans add
  additional explicit blockers.
- No private slip paths, bank references, tokens, provider raw JSON
  or bank-account details are returned.

The return contract **always** includes:
```text
canPostOperationalInvoicePaid = false
canApplyServiceCredit = false
canReleaseTenant = false
sourceCreditLedgerMigrated = false
bankStatementSourceAuthenticated = false
stripeTestShadowIsBankCash = false
writesPerformed = false
```

### 3. Superadmin UI

`react-app/src/components/M7OperationalFinanceReadiness.jsx`
is a compact, collapsible card in
`react-app/src/pages/AdminTenantsPage.jsx`, beside existing finance
history and Stripe TEST Shadow history. It shows the list of missing
evidence in Thai with separate labels for a Firestore Invoice amount,
document-recorded payment and **bank amount not verified**. No
"mark Paid", "apply credit", "release hold" or Stripe provider action.
The UI validates server-provided negative authorization flags before
display, does not display raw bank/private fields, and works at
320/390/768/1440px.

## Regression tests

```text
tests/react-parity/p1-m7-operational-credit-parity.spec.mjs
tests/react-parity/p1-m7-operational-readiness-policy.spec.mjs
tests/react-parity/p1-m7-operational-readiness-browser.spec.mjs
tests/firebase-emulator/p1-m7-operational-finance-readiness.spec.mjs
```

Cases include:
- Go Source 500 THB conversion followed by 152.20/100/300 THB share
  deductions, preserving exact integer satang and idempotence.
- Strict threshold boundary, monthly vs yearly/trial, monthly renewal
  and carry-forward without credit duplication.
- Mixed credit-funded + independently bank-funded monthly
  reclassification, rejecting forged/partial credit reversal.
- Yearly credit offsets forbidden, unsigned values rejected, balance
  overflow/overdraft and duplicate per-month events rejected.
- Firestore Paid with independent reviewer record still cannot prove
  Source bank-cash authority or source Service Credit balance.
- Shadow Stripe TEST never counted as operational bank money.
- Private owner/cashier/inactive Superadmin/cross-tenant/UAT-off
  access denied.
- Missing immutable invoice, pending slip, adjustment, suspended
  tenant and truncated collection scans block operational actions.
- Responsive Superadmin card without action buttons or private data.

## Remaining port work — not yet implemented

1. Create a migration plan from real **Go SQL** invoice/key/snapshot,
   bank-proof and service-credit account/event/conversion tables to
   versioned Firebase documents. Requires explicit original source
   reconciliation and no retroactive charge.
2. Build **server-only atomic** settlement from independently verified
   bank feed/payment source (not Firestore review-only or Stripe TEST);
   shared cross-system reference claims and full refund history.
3. Build financially certified Service Credit conversion and offsets
   in one transaction with a pre-existing, uniquely verified bank
   receipt and source invoice snapshot.
4. Signed per-Invoice hold approval, timed hold enforcement and
   tenant access restoration only after reconciling **all** debts,
   including other security/subscription/revenue-share holds.
5. End-to-end test in dedicated UAT with real Test-mode Stripe
   credentials and separately verified bank source; user must approve
   any Production deployment.

**No operational invoice paid writer, bank/Service Credit migration,
wallet credit or tenant access release was added in this milestone.**
