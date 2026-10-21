# Phase 3AB — privileged paid Delivery writer inventory (SOURCE ONLY)

Updated 2026-10-21. **NOT GLOBAL ENFORCEMENT; NOT PRODUCTION READY.**
Scope: manually inspected checked-in `functions/index.js` exports and the inspected server modules listed below; text-assisted inventory is NOT exhaustive of all dynamically generated writes or client/Admin SDK paths.
No Firebase deploy, no tenant field/receipt coverage changes, no billing release-flag changes.

| Runtime path | Paid mutation | Hybrid protection at this phase | Outstanding |
| --- | --- | --- | --- |
| `functions/delivery-slip.js` `finalizeDeliveryPaymentSlip` (exported Firestore trigger) | `paymentStatus:"paid"`, `paidAt` inside transaction | **NEW** same transaction reads tenant snapshot and refuses Hybrid/migrating/coverage-claim tenants; legacy non-Hybrid permitted | Route to reviewed provider-bound Journal writer; avoid legacy Slip2Go proof being mistaken for independent financial reconciliation |
| `functions/delivery-slip.js` `approveDeliveryPaymentReview` (exported callable) | Cashier manually sets `paymentStatus:"paid"`, `paidAt` inside transaction | **NEW** identical tenant transaction guard; existing already-paid returns unchanged | Bank statement matching + robust double-approval, mandatory Journal enrollment |
| `functions/operational-orders.js` `createWalkInOrder` (exported callable) | Creates walk-in/POS order already `paymentStatus:"paid"` | NOT a Delivery paid-source writer; out of current Delivery invoice scope | Confirm exclusion under future multi-channel billing |
| `functions/public-delivery-submit.js` `submitPublicDeliveryOrder` | Creates only unpaid/pending-verification Delivery orders | Input strips client privileged status/metadata; no paid mutation | Audit all historic admin/legacy import mechanisms |
| `functions/lalamove-webhook.js` | Writes courier lifecycle | No `paymentStatus:"paid"` / `paidAt` from webhook; Delivery COMPLETED != money settled | Independent Lalamove COD remittance and posted-credit proofs |
| `functions/hybrid-billing-*-payment.js`, refund candidates | Unexported candidate transactional financial writers | Epoch admission remains opt-in/demo-only, forced gateway only for four explicit candidate sources | Enforce at ALL server writer entrypoints before cutover and verify provider attestation |
| `firestore.rules` (Phase 3AA) | Client direct mutations | Denies client privileged Hybrid paid/refund fields and deletion of PAID Hybrid Delivery; cannot govern Admin SDK | Validate all client REST/legacy routes and deploy only after full release approval |

Other directly inspected source modules: `tenant-admin.js`, `retail-pos-backup.js`, `revenue-share.js`, `subscription-admin.js`, `tenant-lalamove-wallet.js`, `retail-pos-staff.js`, `saas-migration.js`, `google-delivery.js`, `staff-admin.js`, `delivery-customer-auth.js`, `lalamove-dispatch.js`. This audit did not find direct `paymentStatus:"paid"` literal assignments in those modules; **absence of that literal is not completeness proof**.

## New Phase 3AB partial safety enforcement

- `functions/hybrid-billing-legacy-payment-guard.js` exports pure tenant policy discriminator; missing tenant => fail closed, Hybrid markers (`billingPolicyVersion:hybrid_v1` OR `hybridBillingEnabled:true`) => fail closed, client/server journal coverage flags/mode unexpectedly set => fail closed. Existing empty/legacy tenant policy data is permitted (preserves legacy tenants).
- Both `delivery-slip.js` privileged payment transition paths read tenant in the SAME Firestore transaction as the paid write and deny with `HYBRID_TRUSTED_JOURNAL_WRITER_REQUIRED`. No client new opt-in, no hidden bypass flag.
- `tests/react-parity/hybrid-billing-legacy-payment-guard.spec.mjs` includes pure-state and static code tests; registered in `test:hybrid-billing`. Testing must be confirmed by GitHub Actions for current commit. No claim of 10k true receipt writer transactions.
- Scope is source-only. Until release approval, existing deployed backend is unchanged. If these source updates are someday deployed, they will intentionally BLOCK legacy Hybrid payment finalization instead of silently posting it without a journal; staged rollout needs fully verified replacement writer.

## Mandatory remaining Phase 3AB+ gates

1. Enumerate **all** write paths (including browser SDK, REST, Cloud Function exports, Firestore triggers, Admin SDK backups/imports and dynamic writes) and require server-side source-attested Journal writer enrollment; this partial fence is NOT global.
2. Authenticated Lalamove COD remittance + bank/Wallet **posted-credit** reconciliation, exact order allocation and replay detection on explicitly authorized staging; no delivery-only to paid shortcut.
3. Consistent financial cutoff with race-stable immutable day manifest and late post-cutoff correction lineage.
4. **10,000 real trusted payment-journal writer transactions** with concurrency/index/time/memory benchmarks (the previous 10k synthetic paid records do NOT qualify).
5. Independent Thai tax credit/debit notes, refunds/AR legal+finance review; App Check device/domain and Owner/Super Admin UAT; clear two Firestore Emulator TODOs; finance/security approval.

All four release flags **FALSE**: `HYBRID_REGISTRATION_READY`, `HYBRID_COD_CASHIER_CUTOVER_READY`, `HYBRID_FINANCE_UI_READY`, `HYBRID_FINANCE_API_READY`. Never export candidates from `functions/index.js`, mark coverage ready, deploy Firebase, merge Draft PR #7 or modify real money data.
