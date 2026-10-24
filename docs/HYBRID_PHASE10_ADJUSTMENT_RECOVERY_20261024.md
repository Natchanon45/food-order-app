# Final Phase 10 — Financial adjustments & safe Hybrid recovery

Status: **Private dry-run only; NOT a live refund, credit or auto-unlock service.** 
Date: 24 October 2026. Branch: `feature/react-firebase-port`.

## Non-negotiable money and access safeguards

1. An issued/pending/rejected invoice with date D and `suspendFrom = D+1` is still outstanding until trusted paid settlement occurs. Invoice `paid` status alone is considered settled; a credit proposal is not an actual settlement.
2. Paid invoice documents are immutable. A Credit Note, Refund Request or Chargeback Review is a **separate compensating document** that references the original invoice ID and signature. Its status remains `proposed` until finance approval and any external settlement are independently verified.
3. Credit Note is allowed to be *proposed* only for `issued`/`rejected` invoice states. Refund Request or Chargeback Review proposals require `paid`. Combined non-rejected adjustment proposals must not exceed the invoice amount. This cap prevents repeated compensation; it does not automatically distribute funds.
4. All records are tenant-scoped and deduplicated. Browser-provided invoice amounts, beneficiary accounts, payment state, approvedBy or external payout references are forbidden. Never store raw banking credentials in the candidate.
5. Releasing an account is never inferred from current-month invoices alone. The trusted Admin reader must verify every activation-anniversary period from activation to current Bangkok day, each locked period invoice index, and *all* invoice documents (bounded scan). Missing or corrupt historical data means **manual finance review required**.
6. When it is proven safe to release, the only permitted proposal is `{ hybridBillingSuspended: false }`. A separate suspension (manual/security/legacy) remains and must not be bypassed, and no path sets `active:true`, changes `subscriptionStatus` or credits/refunds Wallet.

## Implementation

- `functions/hybrid-billing-finance-policy.js`: pure `planHybridAccessRecovery`, `prepareHybridAdjustmentProposal`.
- `functions/hybrid-billing-recovery-reader.js`: trusted read-only `prepareTrustedHybridRecoveryReview`; complete anniversary period collection/index check and bounded full invoice scan.
- `react-app/src/auth/tenantAccess.js`: preserve manual/security/legacy hold precedence when Hybrid hold is present.
- `tests/react-parity/hybrid-finance-policy.spec.mjs` — 10 policy scenarios.
- `tests/react-parity/hybrid-recovery-reader.spec.mjs` — 5 trusted-reader scenarios.
- `tests/react-parity/hybrid-billing-report.spec.mjs` — manual hold access tests.
- Existing `HYBRID_PAYMENT_CALLABLE_READY`, `HYBRID_INVOICE_ISSUANCE_READY`, `HYBRID_PAYMENT_UI_READY`, `HYBRID_TENANT_PROOF_SUBMISSION_READY`, and `HYBRID_REGISTRATION_READY` remain `false`.

## Exit criteria still open

- Define refund *destination* and whether actual refund means bank transfer versus platform credit; prohibit automatic Lalamove Wallet replenishment and automatic deduction from other invoices.
- Establish real finance reviewer approval/audit and immutable compensating-event transactions with idempotency under retries; never edit a paid invoice or erase past debt.
- Validate original incoming bank transaction, refund/chargeback initiation and final external settlement; store only sanitized trace IDs.
- Verify all historical activation periods including cutover/migration; temporary missing periods block automated unlocking instead of assuming zero debt.
- Confirm real Slip2Go receiver account ownership and App Check, then Emulator Browser/UAT for concurrent refunds, revocation, outage, manual hold and date boundaries.
- Obtain explicit user permission before setting release flags, merging into `main` or deploying Firebase Production.

## Testing

```bash
npm run test:hybrid-finance-policy
npm run test:hybrid-recovery-reader
npm run test:hybrid-billing
npm run test:react-parity
npm run build:react
```

No Production endpoints were created and no money or account state was changed by this implementation. The owner confirmed the **previous** Mac test suite passed; these latest changes require fresh native tests.
