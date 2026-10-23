# PENGUIN Hybrid Payment — Phase 4 candidate (2026-10-23)

## Owner-approved goal

Use one universal activation-anniversary Billing calendar for **every** tenant. All existing Firestore billing transactions are prelaunch test data, but tenant/product/menu/branding/settings masters must be preserved. This Phase adds a secure payment **backend candidate**, not production release.

**Current status: no real invoice issuance, no payment endpoint deployed, no automatic PAID, no account suspension or reopening, no writes to real Firestore.** Both `HYBRID_REGISTRATION_READY = false` and `HYBRID_INVOICE_ISSUANCE_READY = false` remain in place, and the entire new payment service is deliberately **not imported by `functions/bootstrap.js`**.

## Evidence lifecycle

1. A tenant Owner/Admin uploads a new immutable 10 MB-or-smaller PNG/JPEG/WebP/PDF to the invoice-scoped path `tenants/{tenantId}/hybrid-billing-slips/{invoiceId}/{attemptId}/{fileName}`. Storage Rules deny replacing or deleting these files. This upload path will not be enabled in production until Rules are emulator-tested and released.
2. A future authenticated server callable (not yet exported) must load the **existing issued invoice from Firestore** and its amount. No browser-submitted amount, beneficiary, `paid` flag, or bank details are accepted.
3. Private `prepareHybridInvoiceProof()` fetches real Storage bytes and metadata, checks exact tenant/invoice/attempt path, and uses existing `inspectSlip()` with `providerOverride: 'slip2go'`. Receiver account and API token come from trusted private platform settings.
4. Pure `evaluateSlipVerification()` accepts strict Slip2Go `code=200200` with matched satang, receiver conditions acknowledged by the verifier and real reference/transRef as `bankVerified`. `200000`, OCR/Vision, configured fallback and provider outages are **NOT bank-verified**, even when they detect the correct amount.
5. `stageHybridInvoiceProof()` checks invoice signature and amount inside a Firestore transaction, atomically reserves SHA-256 of actual slip bytes and optional bank reference fingerprints in `hybridBillingSlipReferences` across Hybrid tenants, and creates **one `pending_review` attempt**. The invoice becomes `pending_review`, never immediately `paid`.
6. Private Super Admin service `reviewTrustedHybridProof()` authenticates user role and rechecks historical `revenueSharePayments` and `lalamoveWalletTopups` Slip2Go references; only then may a finance admin approve (`paid`) or reject. For unverified/OCR proofs, explicit `verifiedExternally=true` plus substantive verified-bank narrative is required before approval. Rejection is allowed even when a duplicate reference is detected.
7. `reviewHybridInvoiceProof()` atomically creates an append-only review event, updates the payment attempt and invoice status, and preserves financial amounts, signature, tenant subscription status and suspension state. Already reviewed attempts cannot be reused. Rejected slips remain fingerprint-claimed so they cannot be resubmitted as another shop's payment.

## Firestore and Storage schemas (no deployed writes)

- `tenants/{tenantId}/hybridBillingInvoices/{invoiceId}` gets `status`, `pendingAttemptId`, `latestAttemptId`, `paidAttemptId`, `reviewedAt`. Immutable amount/signature stays unchanged.
- `tenants/{tenantId}/hybridBillingPaymentAttempts/{attemptId}` stores invoice link, amount, verified-provider summary, immutable path, reviewer status and audit metadata. **No raw OCR text, API secrets or full bank details**.
- `tenants/{tenantId}/hybridBillingPaymentEvents/{attemptId}-review` has the Super Admin action, note, timestamp and payment link.
- `hybridBillingSlipReferences/{sha256}` stores global Hybrid-only uniqueness claims derived from the proof bytes and bank reference; browser access forbidden.
- Firestore Rules permit tenant Owner/Admin or Super Admin **read** on invoice, period, attempt and event; all client writes denied. Storage Rules permit tenant Owner/Admin create-only slips and deny update/delete.

## Safety gaps blocking activation

- **Shared atomic deduplication** across the older Revenue Share, Lalamove Wallet top-up and new Hybrid payment paths has NOT been implemented. The private Phase 4 service currently rejects known historical duplicates using a read-only collection-group query before stage/review; concurrent writes from the older workflows remain a race. Therefore automatic paid/activation is forbidden.
- A secure callable/server trigger exposing only strictly validated operations has NOT been deployed or exported. No browser can invoke this service today, so there is currently no end-to-end payment form or Super Admin approval button for Hybrid.
- No production invoice runner exists; final invoice creation/collection remains hard-disabled. Finance must complete bank receipt confirmation policy, credit/refund adjustments, receipt issuance, idempotent webhook verification, cross-ledger consistency, suspension/recovery and quotas.
- Firestore and Storage Rules require emulator security tests, including unauthorized cross-tenant reads, manager/customer denial, PDF/MIME/size caps and immutable upload rejection.
- When allowing a suspended store to submit payments for recovery, explicitly model billing-only access. Never set `tenant.active=true` merely because a slip was approved if the tenant was manually suspended for another reason.

## Tests and deployment

Added `tests/react-parity/hybrid-invoice-payment.spec.mjs` (11 payment state/fraud tests) and `tests/react-parity/hybrid-invoice-payment-service.spec.mjs` (9 tenant/super-admin/legacy-duplicate tests); run with:

```bash
npm run test:hybrid-invoice-payment
npm run test:hybrid-invoice-ledger
npm run test:hybrid-billing
npm run test:react-parity
npm run build:react
```

These were also exercised with an isolated V8 **mock** harness; native Mac Node and Firebase emulator tests are still required. Source code and Rules have only been committed to `feature/react-firebase-port`, **not deployed**. Do not deploy new Rules alone until the corresponding UI and backend release and emulator checks are ready.

Next: implement a shared transaction-reference claim for all Slip2Go-dependent financial workflows, a super-admin invoice approval dashboard with proper pagination and authenticated callable, verified receipt + partial/late refund handling, and recoverable invoice-day scheduler under an explicit release flag.
