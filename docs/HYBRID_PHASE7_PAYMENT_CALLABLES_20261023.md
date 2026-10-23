# PENGUIN Hybrid Billing — Phase 7: Private Callable and Review UI (2026-10-23)

**Implementation candidate, NOT deployed or financially activated.** All stores use universal anniversary billing. No Master shop/menu/product, existing subscription access or real Firestore financial data were modified.

## Prerequisite UAT

The owner ran the phase 6 `demo-penguin-hybrid` Auth/Firestore/Storage Emulator after the optional `ownerEmail` safety fix and reported **7/7 static preflight plus 8/8 actual Emulator integration tests, exit code 0**. The missing-field warning is no longer present in that log. This verifies existing private Admin transaction functions and Rules, **not** the new Phase 7 callable endpoints.

## Backend endpoints prepared

`functions/hybrid-billing-payment-callables.js` adds two callable definitions in `asia-southeast1`:

- `submitTenantHybridPaymentProof` — tenant owner/admin submits only `tenantId`, `invoiceId`, `attemptId`, exact Storage `slipPath`. The trusted service reads the real stored invoice's amount, checks the actual Storage file, calls the existing Slip2Go verification adapter, searches historical Revenue Share/Wallet references and stages one `pending_review` attempt using the global `financeSlipClaims` transaction.
- `reviewHybridInvoicePaymentProof` — Super Admin-only financial review via `action=approve|reject`, note, and optional independently verified bank confirmation. The existing service checks auth, invoice/attempt correlation, amount, immutable signature, legacy reference use, and stores an append-only review event. It never unlocks the tenant or changes a Wallet balance.

Both definitions use **Firebase App Check enforcement** and reject unauthenticated callers. Payloads are strict allowlists, with bounded strings and validated invoice/path IDs; they do not accept amount, beneficiary, paid status, actor identity or mock verification responses from the browser. Server errors are mapped to constrained Firebase HTTPS error codes without leaking bank details.

**Hard lock 1:** `HYBRID_PAYMENT_CALLABLE_READY = false` in the server module. These callables reject requests with `HYBRID_PAYMENT_NOT_RELEASED` even with valid auth.

**Hard lock 2:** The module is **not imported by `functions/index.js` or `functions/bootstrap.js`**; no new payment Callable is exported or deployed from the existing Firebase Functions entrypoint.

**Unchanged:** `HYBRID_INVOICE_ISSUANCE_READY=false` and `HYBRID_REGISTRATION_READY=false`. The billing issuance scheduler is still absent. The new phase does not enable collection or tenant suspension/recovery.

## UI prepared

`/platform/hybrid-invoices` remains a Super Admin-only, paginated, tenant-scoped read-only ledger. Pending-review proof rows now render a bilingual responsive finance note/independent bank verification form with **disabled** Approve/Reject buttons. `react-app/src/data/hybridPaymentActions.js` contains an explicitly **non-operational** action that always rejects with `HYBRID_PAYMENT_NOT_RELEASED` or `HYBRID_PAYMENT_CALLABLE_UNREGISTERED`. It deliberately has **no `httpsCallable` reference** to an endpoint not exported from `functions/index.js`; no financial client mutations are possible. Adding the real adapter and its matching authorized backend export is a separate, gated release.

Approve requires actual verified bank evidence, or separately verified external confirmation with a substantive note; reject needs a reason. The backend revalidates all of these independently. Buttons are not clickable before release.

The tenant-facing invoice history stays read-only and does not offer payment or evidence upload yet. The user interface is a prepared design, not a live payment workflow.

## Testing

- New `tests/react-parity/hybrid-payment-callables.spec.mjs` — 7 permission/financial payload, production lock, App Check, error-sanitization and service delegation tests.
- New `tests/react-parity/hybrid-payment-review-ui.spec.mjs` — 4 disabled form, localized UX and no client payment-write tests.
- Existing `tests/react-parity/hybrid-invoice-review-ui.spec.mjs` — 5 read-only invoice list tests unchanged.
- All new specs are included in `npm run test:hybrid-billing`; standalone `npm run test:hybrid-payment-callables`.

An isolated JS harness passed **7/7 server**, **4/4 new UI** and **5/5 old UI**. Native Mac Node/Vite build and Firebase Functions Emulator tests for the NEW endpoints are **NOT performed**, since Desktop Commander is offline. Do not interpret these as live HTTPS Callable authorization UAT.

Run locally:

```bash
set -e
cd ~/Desktop/Sites/food-order-app
git switch feature/react-firebase-port
git pull --ff-only origin feature/react-firebase-port
npm run test:hybrid-payment-callables
npm run test:hybrid-billing
npm run test:react-parity
npm run build:react
```

## Release gates before real payment

1. Add a demo-only **Functions Emulator** test that invokes the actual Firebase Callable transport with authorized/unauthorized sessions and App Check; confirm role-specific rejects and invoice status transitions. Do not use a live Firebase project.
2. Confirm Slip2Go receiver account, API credentials, Package status and bank reference binding in a dedicated staging/UAT flow. Never treat OCR or 200000 as final bank evidence.
3. Review live Wallet and legacy Revenue Share flow deployment together with global claim writes, clean/backfill all old **test** transactions, and preserve Master records.
4. Complete tenant evidence-upload interface, issued invoices/receipt PDF, credit notes/refund handling, quotas, debt suspension and billing-only reactivation; never reactivate manually suspended stores merely because a slip was paid.
5. Obtain explicit approval before flipping **both** server and UI release locks, exporting named callables through the Functions entrypoint, or deploying any Firebase project. No background/automatic invoice issuance until its separate release review.

**No Firebase Hosting, Functions, Firestore, Storage Rules or Production billing deployment occurred in Phase 7.**

## 23 October 2026 — React Callable Contract correction

Mac regression reported `test:hybrid-payment-callables` **11/11 PASS** and `test:hybrid-billing` **113/113 PASS**, then `npm run test:react-parity` failed at `test:react-callables` for the unregistered client reference `reviewHybridInvoicePaymentProof` in `react-app/src/data/hybridPaymentActions.js`. The shell used `set -e`, so `npm run build:react` did **not run** in that attempt. Cause: `tools/react-callable-contract.mjs` correctly requires all client `httpsCallable(functions, 'name')` calls to be backed by an exported `functions/index.js` entry. The payment Callable module is deliberately private and must NOT be prematurely exported.

**Fix:** Removed the unreleased `httpsCallable` import/reference from the locked React adapter, retained a fail-closed `reviewHybridPayment()` that always rejects, and strengthened `tests/react-parity/hybrid-payment-review-ui.spec.mjs` to require no unregistered endpoint refs. All five review UI tests passed an isolated JavaScript harness. No production funds can move; the server gate and the UI gate remain false. Native Mac `npm run test:react-callables`, full parity and production build are still **pending rerun** after this fix.

Safe Mac checks: `npm run test:hybrid-payment-callables`, `npm run test:react-callables`, `npm run test:react-parity`, `npm run build:react`. Never bypass this contract by constructing dynamic Callable names, nor add a production Function export just to satisfy a static check.
