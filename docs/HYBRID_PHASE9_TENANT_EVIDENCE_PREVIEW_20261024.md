# PENGUIN Hybrid Billing — Phase 9: Tenant Payment Evidence UX (Closed Preview)

Date: 24 October 2026  
Branch: `feature/react-firebase-port`

## Status

The project owner confirmed that the Phase 8 demo-only Firebase Functions Emulator retest **passed**; no new detailed Mac log was provided in this turn, and Remote Desktop Commander was offline, so this note does not independently attest the exact real transport test counts. Phase 9 changes are **committed in the feature branch, not built natively on the Mac and NOT deployed**.

All earlier release gates remain closed: `HYBRID_INVOICE_ISSUANCE_READY=false`, `HYBRID_PAYMENT_CALLABLE_READY=false`, `HYBRID_PAYMENT_UI_READY=false` and new `HYBRID_TENANT_PROOF_SUBMISSION_READY=false`. No payment endpoint is exported to Production. No test writes, bank transfers, Wallet charges, tenant Master data edits or financial reversals were performed.

## Tenant UX

On `/reports/hybrid-billing`, the owner/admin's existing **Issued invoices** table now has an Evidence column. Only genuine ledger items with `issued` or `rejected` status, a valid deterministic invoice identifier, and a positive cent-accurate invoice amount show **Prepare slip**. `pending_review` and `paid` invoices have no action. **This is distinct from the nonpayable projection table above**.

Selecting an eligible invoice displays `HybridTenantProofPanel`:

- Displays the selected real invoice ID and amount, not a browser-calculated payable balance.
- Clear bilingual Thai/English warnings that payments are not enabled; no verified bank-account instructions are shown; explicitly tells the user not to transfer money.
- Local-only file chooser accepts JPEG, PNG, WebP or PDF, rejects empty, invalid, oversized or suspicious file names; maximum file size 10 MiB (10 × 1,048,576 bytes), aligned with the backend and Storage Rules.
- Lists the local file name, size and validation result, but **does not read or persist file bytes**, allocate an attempt ID, create a Storage path, call Firebase Storage/Functions, send a transfer to a bank or set invoice `paid`. The selected `File` object exists in component memory only and is discarded when selecting another invoice/tenant or unmounting.
- Disabled **Submit evidence** button remains disabled regardless of file validity. Pure helper `submitHybridTenantProof` throws `HYBRID_PAYMENT_NOT_RELEASED` unconditionally.
- Layout is responsive on desktop/mobile and uses existing app icons, card styling, locale and accessibility labels.

Files:
- `react-app/src/data/hybridTenantPaymentDraft.js` (file/invoice validation and permanent release lock)
- `react-app/src/components/HybridTenantProofPanel.jsx`
- `react-app/src/pages/HybridBillingReportPage.jsx` (invoice-selector integration only)
- `react-app/public/parity/css/hybrid-billing-review.css`
- `tests/react-parity/hybrid-tenant-proof-ui.spec.mjs` (6 scenarios)

## Verification

Six tests for invoice eligibility, MIME/size policy, local-only metadata, disabled submission, page integration, responsive bilingual UX passed in an **isolated JavaScript verification harness**, not an actual Mac Node.js/Vite build. Added:

```bash
npm run test:hybrid-tenant-proof
```

The spec is also included in `npm run test:hybrid-billing`.

Mac verification after pulling the feature branch:

```bash
set -e
cd ~/Desktop/Sites/food-order-app
git switch feature/react-firebase-port
git pull --ff-only origin feature/react-firebase-port
npm run test:hybrid-tenant-proof
npm run test:hybrid-billing
npm run test:react-parity
npm run build:react
```

Preserve existing locally modified generated `public/**/index.html`. Do not use `git reset --hard`, `git clean`, or deploy to Firebase. User should visually inspect desktop and mobile invoice status badges, table overflow and the locked form.

## Requirements for a live Phase 10 release

1. Complete independent production-grade bank beneficiary verification and finance approvals, real App Check tests, actual receipt and credit-note/refund flows.
2. Design secure server-generated attempt IDs/paths, upload constraints and explicit authorization; never trust client-supplied amounts, OCR bank status or `paid` flags.
3. Hook client `uploadBytes`/Callable only alongside a corresponding reviewed production export and permission controls; `tools/react-callable-contract.mjs` MUST continue to pass.
4. Prevent duplicate cross-channel bank reference use across Wallet, Revenue Share and Hybrid with the shared `financeSlipClaims` atomic registry, including historical test-record handling.
5. Keep original shop activation anniversary as the threshold clock, and never allow a Hybrid payment to reactivate a tenant manually suspended for other reasons.
6. Obtain explicit approval to activate and deploy any new financial payment/issuance workflow.

**No Production Firebase deployment, financial data mutation or bank account instruction was introduced.**

## Phase 9 closeout hardening — 24 October 2026

The asynchronous preview and invoice list were reviewed on the actual GitHub source. A late response from tenant A could previously append to tenant B's paginated list, and old month/tenant preview results could race with new data. These are UI-context isolation issues, not trusted server payment mutations. The updated page scopes invoice lists by tenant/role/refresh-generation and preview results by tenant/month with a monotonic request guard; the invoice list gains its own Refresh control. Pagination only merges for a matching scope and cursor, deduplicates by actual Firestore document ID, and switching invoice status or amount clears the file selection.

**Checks required:** Run the enhanced `test:hybrid-tenant-proof`, `test:hybrid-billing`, `test:react-parity` and `build:react` natively on the Mac (offline at edit time). Inspect desktop/mobile width 320/375/768/desktop, keyboard access, slow request races, invoice selection and disabled submit; these were not rendered as screenshots during GitHub-only review. Previous owner-supplied Mac logs at `123c207a` confirmed 6/6 local-proof tests, 132/132 Hybrid tests and a passing React build **before this hardening**. No claim of rerun is made.

Phase 10 preparation only: issue upload-attempt identity on a trusted authenticated server with App Check; authorize tenant owner/admin and immutable invoice-bound Storage paths; validate file signature/MIME/10 MiB, hash bytes server-side; write shared anti-reuse claims transactionally across Hybrid/Wallet/Revenue Share; reject double submission/changed invoice/tenant suspension; call private server verification and put evidence into `pending_review`, not `paid`; require audited Super Admin external confirmation to approve; test denial/idempotence/rejection/suspension cases against demo emulators before any explicit production release approval. Beneficiary bank-account verification, receipt/refund flows and real App Check UAT remain release blockers.
