# PENGUIN Firebase — M7 Finance Evidence History (read-only partial port)
**Date:** 2026-11-22 · **Source read-only:** cosmatch/lukkhaja @ feature/lukkaja_bankalert_stripe, commit 03d2aaee
**Target:** Natchanon45/food-order-app @ feature/react-firebase-port
**Deployment:** NOT performed. No actual Stripe settlement is claimed.

## Comparison with the Source

LUKKAJA Source `goapi/cmd/web/m7_platform_payment_history.go` presents immutable M7 **Stripe checkout attempts**, and may display `verified` only when there is:
1. a committed checkout settlement amount matching the original reservation;
2. the invoice's independently recorded bank-paid amount satisfying the amount;
3. an invoice in a paid state (or a separately audited monthly-to-credit conversion).

A failed condition downgrades a source "verified" record to "needs_review";
ordinary waived invoices do not count as Stripe-paid. Source routes include
`GET /api/platform/m7-finance/payment-history` and authenticated
`GET /api/tenant/m7-finance/payment-history`, with status, fee type and
Bangkok payment-date filters and 200-item bounds.

Firebase currently has **no matching M7 Stripe reservation + settlement
ledger for Platform/Delivery invoices**. It has a separate **Lalamove Wallet
Stripe Sandbox**, an existing Hybrid Billing invoice + proof-review ledger,
and legacy Delivery revenue-share payment records. These three sources must
**never be merged or relabeled as Stripe M7 settlements**.

The port therefore implements a deliberately separate, server-only
**evidence history projection** for the two relevant *non-Stripe* existing
Firebase financial evidence sources. It is not a duplicate finance
transaction workflow and does not change amounts, statuses or access.

## Implementation tree

```text
functions/
  m7-evidence-history-policy.js   exact THB satang, Bangkok day, provenance, review-status mapping
  m7-evidence-history.js          authenticated bounded read-only projection
  index.js                        exports merchant/superadmin Callable readers
react-app/src/
  components/M7FinanceEvidenceHistory.jsx
  ui/m7-finance-evidence-history.css
  pages/AdminTenantsPage.jsx      platform historical evidence (select a tenant)
  pages/RevenueShareReportPage.jsx  merchant owner/admin historical evidence
tests/
  firebase-emulator/p1-m7-evidence-history.spec.mjs
  react-parity/p1-m7-evidence-history-browser.spec.mjs
```

## Sources / display state

| Firestore collection | Linked evidence | UI type | Recorded status meaning |
|---|---|---|---|
| `tenants/{tenantId}/hybridBillingPaymentAttempts` | `hybridBillingInvoices` and `hybridBillingPaymentEvents` | Platform or Delivery daily (per invoice ID) | `recorded` **only** if paid attempt + invoice paid + matching reviewer audit (bankVerified or explicit external confirmation with substantive note) + exact amount + immutable signature |
| Same Hybrid collection | Missing/mismatched documents or an inconclusive paid attempt | Same | `needs_review`; never infer Stripe payment |
| Same Hybrid collection | Matching pending invoice/attempt | Same | `pending` |
| Same Hybrid collection | Matching reject event | Same | `rejected` |
| `tenants/{tenantId}/revenueSharePayments` | Existing submitted/approved/rejected legacy record | Delivery daily | `recorded` only when approved by an identifiable server reviewer; not Stripe |
| Same legacy collection | Missing review, invalid amount/date or unknown state | Delivery daily | `needs_review` |

Response:
- `source="firebase_m7_finance_evidence_not_stripe_settlements"`;
  `settlementSourceAvailable=false`, `readOnly=true`, `currency="THB"`;
- Every row has `stripeSettled=false`, `bankSettlementVerified=false`,
  `verifiedStripeCents=0` regardless of its recorded approval;
- `amountCents` is the stored evidence amount, while
  `recordedCents` is the *accounting system's recorded* value when
  independently reconciled with the invoice/reviewer event (Hybrid)
  or the committed approved record (legacy); **not a bank certificate**;
- Never sum legacy and Hybrid evidence into an accounting balance: both
  sources can reference overlapping liability and are displayed separately
  with provenance. No private notes, slip paths, bank references, OCR, payment credentials,
  full account numbers or Stripe customer references are returned.

## Authorization / query safeguards

- All reads happen through Firebase Admin SDK; **no Firestore Rules change**.
  They do not read financial collections directly from the browser.
- Merchant uses `getOwnM7FinanceEvidenceHistory`. The server resolves tenant
  only from the authenticated active owner's/admin's profile, including
  suspended merchants' finance history; caller-supplied `tenantId` is rejected.
  Cashier, kitchen, other tenant and Superadmin accounts cannot call this route.
- Superadmin uses `getPlatformM7FinanceEvidenceHistory`, with an explicit
  tenant selection. When no tenant is selected, return `selectTenant=true`
  and zero items. This is an intentional *partial port* of Source's
  all-tenant M7 view: it prevents unbounded cross-tenant Firestore reads.
- A strict status filter (`all/pending/recorded/rejected/needs_review`),
  fee type (`all/platform/delivery_daily`) and inclusive Gregorian date
  range (based on payment timestamp +07:00, **not invoice due date**) apply.
- Read at most **201 per source**, return the first **200 combined**.
  `hasMore` warns on partial scans, not silent completeness. Querying
  an older range requires narrowing the source's data volume or implementing
  trusted pagination later.
- Client checks source tag, tenant, currency, flags and row statuses before
  showing anything. On mismatches/timeout, show an explicit error rather than
  fake an empty or "verified" history.

## UI

- Merchant: a separate **collapsed** evidence-history detail below existing
  Delivery share history, with status chips, fee kind, start/end dates, amounts
  and references. Restricted to owner/admin.
- Superadmin: a separate **collapsed** card below existing legacy
  Revenue Share payment history, one selected tenant, horizontally scrollable
  native table, with the same filters.
- Layout tested at 320/390/768/1440 CSS px. No changes to legacy reports,
  Stripe Wallet Sandbox, invoice issue, Superadmin approval, or bank cash.
- **No user may submit, approve, refund, cancel, settle, or release a shop
  from this history screen.**

## Acceptance scenarios

1. Authenticated merchant receives only own evidence; tenant supplied in
   request rejected, even if self; staff cashier, inactive user, Superadmin
   through merchant reader and ordinary merchant through platform reader
   rejected.
2. Active Superadmin can select a specific tenant; no tenant means an
   explicit select-tenant state, not an all-store incomplete result.
3. Paid Hybrid proof requires consistent invoice signature, exact amount,
   paid attempt reference, independent verification witness and audit; tampered paid invoice becomes
   `needs_review`.
4. An approved legacy payment without a recorded reviewer is
   `needs_review`; missing timestamp/invalid amounts fail closed.
5. Pending, rejected and recorded labels are distinct; no Stripe
   verified amount is invented.
6. Inclusive Bangkok date filtering and invalid Gregorian dates/ranges.
7. Platform vs Delivery daily kind includes both Hybrid daily invoices and
   legacy Delivery share; no overlap or missing Hybrid delivery records.
8. 201+ items set `hasMore`; a source scan is capped at 200.
9. Read-only: invoice snapshots before/after lookup remain identical.
10. Browser layout and filters on 4 screen sizes for both roles, plus route
    integration and public Callable contract.

## Known exclusions and required next work

- **NOT PORTED:** M7 Stripe checkout creation, source's immutable Stripe
  reservation/settlement ledger, bank-paid cash reconciliation, Service
  Credit conversion proof, refund/credit reclassification, cross-tenant
  verified M7 summary and backdated monthly/yearly Stripe payments.
- **NOT TESTED:** live Stripe test transactions in a dedicated UAT project,
  actual merchant finance records or private production historical records.
- No Production deployment or database/schema migration performed.
- Next: design a separate M7 Stripe TEST reservation + webhook ledger using
  the source invariants, signed provider proof and idempotent transaction
  claims, with no implicit inheritance from Lalamove Wallet Sandbox. Reconcile
  paid bank / Service Credit conversion only after complete E2E UAT.
