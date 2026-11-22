# PENGUIN Firebase Port — Actual Hybrid Issued Invoice and Payment-Status Module

**Date:** 22 Nov 2026 (Asia/Bangkok)
**Source read-only:** `cosmatch/lukkhaja` / `feature/lukkaja_bankalert_stripe` @ `03d2aaee`
**Target:** `Natchanon45/food-order-app` / `feature/react-firebase-port`
**Module scope:** Production-capable, strictly READ-ONLY existing Firebase Hybrid Invoice and Payment Attempt status display for merchants and Superadmin.
**Not in scope:** Actual M7 Source MariaDB paid-cash migration, accepting new merchant payments, Service Credit posting, suspension or tenant release.
**Deploy:** Not performed.

## Why this actual module instead of another UAT Shadow

Earlier milestones built substantial isolated financial and Stripe UAT
proof systems, but the actual merchant Hybrid invoice list still
queried *raw* Firestore invoice documents, and platform invoice summaries
aggregated the bare `invoice.status === "paid"`. That produces
misleading financial displays when a historical/manual Firebase Paid
flag has no matching reviewer and immutable payment attempt.

The Source Go M7 invoice display expects a genuine immutable
invoice, a matching bank/credit accounting snapshot, and a corresponding
provider/reviewer proof. Source's canonical M7 read is separately
gated until its issuer/settlement authority is available.
Firebase's existing `hybridBillingInvoices` is a **different ledger**
with different IDs and HMAC/SHA provenance; its Paid status CANNOT
stand in for independently certified Source M7 bank money.

This module therefore ports the **real usable read/readiness flow** now:
a tenant-scoped, server-owned, consistent snapshot of already-issued
Firebase invoices + matched Firestore payment/review evidence,
shown identically on the Merchant and Platform pages. All payment
creation and ledger mutations remain blocked.

## Actual Firebase collections read (read-only transaction)

```text
users/{authenticatedUserUid}                              # active owner/admin or Superadmin
tenants/{authorizedTenantId}
tenants/{tenantId}/hybridBillingInvoices/{invoiceId}       # issued original
tenants/{tenantId}/hybridBillingPaymentAttempts/{attemptId} # selected by original Invoice
tenants/{tenantId}/hybridBillingPaymentEvents/{attemptId}-review
```

The server determines the tenant from the active Owner/Admin profile.
The merchant cannot provide a different tenant ID. For the Superadmin,
an explicit selected `tenantId` is permitted after active-role
validation. Both roles use the **same status policy**.

Invoice list pages sort by the actual Firestore `date` field,
newest first, using `limit + 1` and a validated document-ID
cursor. The cursor document is read in the same read-only transaction.
Each page has at most 30 invoices (default 20), with only the
invoice's selected matching attempt/review queried by immutable ID.

### What counts as evidence?

| Firebase state | Proof required | Merchant/Platform display |
|---|---|---|
| Issued, no linked attempt | Valid immutable `hybrid-invoice-v1`, amount, kind/date | Not submitted |
| Pending review | Invoice pendingAttemptId + latestAttemptId, exact same attempt identity/signature/satang, no review event | Pending review |
| Rejected | Exact attempt/reviewer and immutable rejection event with substantive note | Rejected |
| Paid | Exact linked `paidAttemptId`, `latestAttemptId`, immutable attempt and approving reviewer event, same tenant/invoice/signature/amount, matching reviewer and bank-proof flag or substantive independent manual review | Recorded Paid in Firebase (**Source bank unverified**) |
| Missing, inconsistent, mutated or incomplete payment proof | No validated proof | Needs review; does not prepare file or count as recorded Paid |
| Corrupt immutable Invoice amount/key/tenant/version/date | No safe financial amount | Entire page fails closed; no untrusted row displayed |

Even for a matching Firebase review:
```text
sourceM7BankReconciled = false
independentBankStatementVerified = false
operationalCashSettled = false
canSubmitPayment = false
canReleaseShop = false
paymentSubmissionEnabled = false
financialPostingEnabled = false
writesPerformed = false
```

The API never includes raw Slip2Go response, original slip path,
receiver/payee bank account, bank reference/transRef, reviewer free-text
notes, internal signature/hash, actor identity or private storage
metadata.

## Files

```text
functions/hybrid-issued-invoice-status-policy.js
  Server-shared finite-state validation of issued, pending, rejected,
  Paid with authentic stored reviewer event and needs_review.

functions/hybrid-issued-invoice-status.js
  Two server callables with the same read-only transactional projection:
    getOwnHybridIssuedInvoiceStatusPage({cursor?,limit?})
    getPlatformHybridIssuedInvoiceStatusPage({tenantId,cursor?,limit?})

functions/index.js
  Register both READ callables, no new Paid/credit/hold writer.

react-app/src/data/hybridIssuedInvoiceStatusClient.js
  Exact allowlisted response; reject false bank/operational flags,
  cross-tenant response and unsafe cursors, then reduce to UI fields.

react-app/src/pages/HybridBillingReportPage.jsx
  Merchant existing Hybrid Billing workspace reads sanitized server
  issuance/payment status; paginates and blocks suspicious invoice
  actions, local draft remains disabled for real payment submission.

react-app/src/pages/HybridBillingReviewPage.jsx
  Superadmin existing Hybrid review workspace reads the identical
  server projection and aggregates only evidence-backed, recorded
  Firebase Paid (explicitly unverified against Source).
  Slip verifier flag labels no longer claim that original Source
  bank money has been independently confirmed.

tests/react-parity/p1-hybrid-issued-invoice-status-policy.spec.mjs
tests/react-parity/p1-hybrid-issued-invoice-browser.spec.mjs
tests/react-parity/p1-hybrid-issued-invoice-platform-browser.spec.mjs
tests/firebase-emulator/p1-hybrid-issued-invoice-status.spec.mjs
```

## Validation and scope acceptance

- Owner/Admin can read their own issued invoices even while the shop
  has a separate billing hold. They **cannot** access another tenant's
  invoices or choose a tenant ID in the call payload.
- Superadmin can inspect a selected tenant using the separate
  explicit-tenant endpoint. Owner/Cashier/Kitchen/inactive accounts
  cannot invoke the Superadmin endpoint.
- A Forge/Injected "Paid" flag without matching reviewer event and
  attempt becomes `needs_review`, never "verified" bank cash.
- A signed-looking immutable record with a wrong amount, signature,
  version or tenant cannot be shown as payable.
- No bank credentials or private note/reference leaks to browser
  through these two Callables.
- Cursor and request payloads cannot override money, status, tenant,
  backend source, bank verification or roles.
- Pagination is stable, duplicate-free and scoped to the original
  tenant. Old list requests cannot replace a new merchant scope.
- Merchant UI and Platform UI behave consistently at 320, 390,
  768 and 1440 px. The Proof Panel remains local-only in a real
  project; not a payable wire transfer instruction.
- Firestore Emulator verifies actual documents and read-only
  transaction behavior; no real financial documents change.

## Remaining blockers (not misrepresented as completed)

This module makes **existing Firebase Hybrid invoices easier and safer
to inspect**. It does *not* create missing canonical M7 Source invoices
or authorize Source-paid bank cash. On the previous source branch,
real M7 Source SQL ledger reads are protected by a separately gated
release and independent issuer/payment/beneficiary validation.
The Firebase Hybrid payment submit/review callables are intentionally
hard-locked at `HYBRID_PAYMENT_CALLABLE_READY=false`.

To genuinely activate new payments and credit, first implement and
verify a trusted issuer, shared bank-ref global claims with legacy
cash/delivery/Lalamove, bank source attestation, immutable M7
Service Credit account/events, and signed hold release policy.
Those are **different operational modules** and must not be bypassed
by a React button or a mutable Paid document.

No Source repository modification, no Firebase Hosting or Functions
Production deployment. This module is committed only after
full regressions pass.

## Final acceptance — actual Firebase data paths

| Verification | Result |
|---|---|
| Pure immutable invoice, attempt and reviewer policy | **5/5 PASS** |
| Merchant + Superadmin actual-page Chrome UI at 320/390/768/1440 px | **4/4 PASS** |
| `npm run test:hybrid-issued-invoices` | **9/9 PASS** |
| Firestore Emulator server-role/tenant/cursor, real invoice + review documents | **5/5 PASS** |
| Combined existing Firestore Emulator, Stripe TEST, BankAlert and Telegram regressions | **80/80 PASS** |
| Old merchant / Platform finance UI contract regression updated for new server-owned path | **20/20 PASS** |
| `npm run test:react-parity` full project chain | **PASS** |
| `npm run test:react-callables` | **114 references, 0 missing exports** |
| `npm run build:react`, generated bundle contract | **PASS** |
| Real bank/SQL settlement verified externally | **NOT VERIFIED (intentionally distinct)** |
| Production deployment | **NOT PERFORMED** |

The production-facing read Callables are **registered in Source only**;
the latest build has **not** been deployed to Firebase Hosting/Functions.
The two older Hybrid payment write Callables remain hard-disabled. The
existing original Source Android companion's uncommitted changes were
preserved and were not included in this module.

**Module acceptance outcome:** The read-only issued-invoice/evidence
status feature works against real **Firebase Firestore documents**
in controlled Emulator tests and is wired into both existing React
pages. It is not a claim that Source MariaDB/M7 cash or new payments
are fully ported.
