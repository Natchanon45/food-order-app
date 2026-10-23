# Hybrid Phase 5: Shared Bank Proof Claims and Invoice Review (2026-10-23)

Branch: `feature/react-firebase-port`. Code-only candidate; **no deployment or production Firestore mutations**.

## Core goal

The project owner confirmed the SaaS Firestore data is test/prelaunch only. All stores follow a universal activation-anniversary threshold calendar. Preserve shop, menus, products, staff and all master/settings data. The owner manages old test record removal; **do not execute bulk delete scripts**.

## Transaction-safe shared anti-reuse registry

`functions/finance-slip-claims.js` provides immutable cross-product fingerprints under `financeSlipClaims/{claimId}`, with identifiers:

- `file_{SHA256 of original Storage file bytes}`
- `bank_{SHA256('finance-slip-bank-v1:' + normalized bank transfer ref)}` (the same namespace for referenceId and transRef).

No raw reference, bank account or slip image is recorded in a claim document. Each record has channel, tenant ID, payment/attempt ID and creation timestamp. A rejected reference remains claimed, intentionally, unless an independently audited false-positive reversal process is added.

Three channels now share the same Firestore **transactional** claims:

1. Wallet top-up in `functions/tenant-lalamove-wallet.js`: reads old `lalamoveWalletTopupDedupe` and new `financeSlipClaims` before crediting the wallet/creating the topup; writes new claims in the **same transaction**. Its historic channel-local dedupe is retained.
2. Revenue Share in `functions/revenue-share.js`: reads Storage bytes and SHA-256, checks historic bank refs and claims, then atomically creates the payment and global claims. Existing payout/auto-approval policy is otherwise unchanged.
3. Hybrid in `functions/hybrid-billing-payment.js`: staged pending-review payment reserves both Hybrid-local fingerprints and global `financeSlipClaims` inside one transaction, never marking an uploaded slip automatically paid.

**Deployment rule:** all three modified server paths must be deployed together with the restrictive global Firestore Rules. Deploying only one creates a period in which the other two can still issue an unclaimed transfer. Because `financeSlipClaims` is brand new, any old test records are NOT backfilled. For a real launch, run a controlled historical inventory/backfill or owner-verified removal of old test payments; otherwise no claim can prove an older slip wasn't used previously.

Browser access to `financeSlipClaims` is entirely denied; Admin SDK transactions bypass browser Rules. Firebase Emulator should validate claims, security, and conflicting concurrent submissions before release.

## UI: read-only invoiced balances (not projected fees)

`/platform/hybrid-invoices` is a Super Admin-only route linked from the Platform dashboard. It lists up to 50 stores per cursor page, then issued invoices and payment attempts in paginated tenant-scoped subcollections. Shows status (`issued`, `pending_review`, `paid`, `rejected`), bank-verified yes/no, amount and linked invoice, with Thai/English text. It does not show bank account details, full references, raw OCR text or confidential Storage links.

`/reports/hybrid-billing` now retains the existing **read-only estimate** and adds a separate paginated issued-invoice section scoped to the logged-in tenant. The copy prominently distinguishes non-payable projections from actually issued invoice records.

UI data source: `react-app/src/data/hybridInvoiceReviewData.js` uses Firestore client SDK `getDocs` and `startAfter` cursors; read permissions are enforced by Firestore Rules. **Neither page has a Pay, Upload, Approve, Reject or invoice creation action.** New collections may be empty until issuance is enabled.

## Safety status and open work

- `HYBRID_REGISTRATION_READY = false`, `HYBRID_INVOICE_ISSUANCE_READY = false`, and Hybrid payment modules remain absent from `functions/bootstrap.js`. Slip2Go proof staging and manual review are still private server functions, not deployed callable endpoints.
- Storage Rules allow only owner/admin create-only invoice proof uploads, prohibit overwrite/delete; client Firestore write access to invoice/attempt/review/claim collections remains denied. Rule changes have **not** been deployed or tested in Emulator.
- `financeSlipClaims` removes simultaneous cross-product write races for these three newly updated code paths, but preexisting old documents / stale deployed Cloud Functions require coordinated migration or removal before real collection.
- We have not implemented automatic billing issuance, real verified receipt issuance, customer upload UX, Super Admin authenticated approval callable, adjustment notes, or subscription suspension/recovery. Never auto-unlock a shop after a payment.
- A new issue is separate from this scope: the old Revenue Share and Wallet channels currently retain prior auto-approve behavior for successful Slip2Go; Phase 5 only adds transaction-level global duplicate prevention, not a change to those established workflows.

## Validation

New tests:

- `tests/react-parity/finance-slip-claims.spec.mjs` — common fingerprints, cross-channel reuse, parallel stale transaction collision, forbidden client claim access.
- `tests/react-parity/hybrid-invoice-review-ui.spec.mjs` — role-protected route, pagination, read-only client behavior and localization.
- Existing `tests/react-parity/hybrid-invoice-payment.spec.mjs` updated to check universal claim-conflict error.

Isolated JavaScript V8 mock runs passed **6/6 common claims**, **11/11 Hybrid payment**, **5/5 read-only UI static tests**. These are NOT native Node/Vite or Firebase Emulator tests.

After pulling on the Mac without resetting local generated HTML files:

```bash
npm run test:finance-slip-claims
npm run test:hybrid-invoice-payment
npm run test:hybrid-invoice-review-ui
npm run test:hybrid-billing
npm run test:react-parity
npm run build:react
```

**Release blocker:** Emulator security tests and native Mac build are pending. Do not deploy only Hosting or only Rules to production as a shortcut. Rollout must include atomic shared claims across Wallet, Revenue Share and Hybrid server code plus a reviewed launch plan.
