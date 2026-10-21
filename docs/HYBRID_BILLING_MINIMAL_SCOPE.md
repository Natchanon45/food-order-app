# PENGUIN Hybrid Billing — complete source workflow and UAT readiness

Updated 2026-10-22 (Asia/Bangkok). Single working branch `feature/hybrid-billing-delivery-only-minimal`, Draft PR #8. The older PR #7 is historical only.

## Implemented scope

- Only **PAID Delivery merchandise** enters the Tenant platform fee. POS, Table, Takeaway, walk-in, Lalamove charges, COD remittances and customer delivery fees never contribute.
- 10,000 THB paid Delivery threshold per Bangkok signup anniversary cycle. On the threshold-crossing day and following days, 5% of that day's eligible Delivery merchandise is billed, not earlier days. First under-threshold cycle has no fixed fee; later under-threshold cycles use the configured monthly flat fee (default 590 THB). All thresholds/rates/quota values remain Super Admin editable.
- New Hybrid signup has an explicit global rollout switch, **OFF by default**. Signup stores one immutable trusted server instant and Bangkok calendar start date. Retries cannot shift the first day; activation is idempotent.
- Tenant report shows an as-of-day fee projection and a **separate, persisted invoice history**. Projection is never mistaken for a payable invoice.
- Super Admin configures the PENGUIN bank recipient and opens billing by Tenant only after explicit confirmation. Invoices freeze their price and payment-destination snapshot. Retried issuance is idempotent. Changed historical sales or pricing cause a reconciliation error instead of mutating prior bills.
- Daily scheduled issuing/reconciling is enabled only for explicitly live Hybrid tenants. Only completed prior Bangkok calendar days can be invoiced. Invoice due date is the **actual issue date**, and automatic Hybrid suspension cannot begin before the following Bangkok day; a newly issued invoice must never suspend a shop instantly.
- Tenant uploads bank-transfer proof (JPG/PNG/WebP/PDF, max 10 MB) to a Tenant+invoice+payment isolated Storage path. Owner or Admin can view own bill and submit proof. Super Admin verifies/approves/rejects transactionally. Repeats cannot approve or submit the same pending/paid payment. Pausing fee collection keeps old invoices settleable and releases only Hybrid-origin suspension.
- Hybrid-only Slip2Go usage counter is transactionally reserved once per order. Default 100 per anniversary cycle, unlimited after threshold. At quota limit, cashier manual review is used, without blocking the Delivery order. Usage count is shown on Tenant billing page.
- Cashier continues normal workflows, but Hybrid Delivery payment confirmations use Firestore server-assigned `paidAt`, ensuring canonical billing timestamps. Legacy and other channels are unchanged.

## CI and integration verification

`.github/workflows/hybrid-billing-minimal.yml` runs on push and PR without production deployment:
1. Calculator, order-audit, signup, UI and legacy contract tests plus React production build.
2. Local Firebase **Firestore, Storage and Auth emulators**, using demo project `demo-hybrid-ci` (no external credentials): real Firestore issuance/idempotency/amount reconciliation; a payable-day grace before suspension; late-invoice suspension and restoration; platform payment review authorization and duplicate rejection; real bank-slip Storage upload and transactional submission/approval; end-to-end gated/signup/activation and anniversary preservation; Storage owner authorization and cross-tenant deny; Slip2Go quota retry/count; pausing access recovery; cross-tenant billing history denial.

Latest exact HEAD / job status must be checked on https://github.com/Natchanon45/food-order-app/pull/8 before merge.

## Release safety, facts and remaining real-environment requirements

- This is a **source-complete candidate**, NOT a production deployment. CI and Firebase emulators cannot certify bank receipt, production quotas, full historic completeness, or customer financial consent.
- Current billing previews retain `coverageCertified:false` and `canIssueInvoice:false`: these indicate the estimator is not an independently certified transaction ledger. Explicitly enabled Super Admin issuance requires the `RECONCILED_DELIVERY_SOURCE` attestation and does not silently invoice from noncanonical historical records.
- Historical paid Delivery `paidAt` ISO strings still require authorized reconciliation before charging migrated tenants. Unknown/malformed source data fails closed. No automatic financial backfill or live data mutation was attempted.
- Real bank destination, policy sign-off, deployment/merge and production UAT using consented staging data require the product owner's explicit action. No production charges or suspensions were triggered from this chat. All rollout controls remain OFF until deliberately enabled.
- Existing POS, Table/Takeaway and Lalamove settlement flows are not modified for Hybrid fees.

## Final safety acceptance checklist

- Verify a fresh Hybrid test Tenant's signup, business type and Bangkok anniversary date on staging.
- Confirm paid Delivery goods only, refunds, timestamp normalization and first-cycle charge policy against consented real order fixtures.
- In staging, issue a day-closed invoice twice; confirm one immutable invoice, correct due date and bank snapshot.
- Upload and review a Tenant payment proof; confirm duplicate submissions fail and a paid invoice cannot be issued or approved twice.
- Simulate overdue invoice and approval, confirm access only changes for Hybrid-owned suspension and is restored.
- Confirm quota exactly 100 and that a later attempted Slip2Go review falls back to manual without affecting checkout.
- Set real bank destination and explicit rollout flags only after reviewing these results. **Do not enable production solely because GitHub CI is green.**

No new project, PR, or separate-chat handoff is required.

## Source hardening before owner-run UAT (2026-10-22 Bangkok)

This section tracks targeted corrections to the existing Delivery-only PR #8; it does **not** authorize an environment deployment, monetary charge, PR merge, or a rollout switch change.

- **Unapproved proof is unpaid:** an overdue invoice with `paymentStatus=pending` is still unpaid. A tenant suspended for that overdue bill must not become active solely because a slip was uploaded. Only Super Admin approval marking the invoice `paid` can restore Hybrid-owned suspension (assuming no other overdue invoice).
- **Atomic/current access check:** suspension/recovery now reads the *current* Tenant, issued-invoice query, and slug ownership within one Firestore transaction. Stale request snapshots cannot overwrite a separately paused Tenant. A slug belonging to another Tenant causes a fail-closed error; a missing slug is never implicitly created.
- **Frozen invoice bank:** Tenant payment UI uses `invoice.paymentDestination` only. If an old or invalid invoice lacks a frozen bank snapshot, the page requires contacting PENGUIN rather than substituting the current platform bank (which may have changed after issuance).
- **Emulator regressions:** pending proof stays suspended until paid; stale Tenant snapshot cannot force a new suspension; changed slug ownership cannot be overwritten. Existing invoice idempotency, payment review, old Cashier/POS exclusions, signup, Slip2Go, React build and Storage/Auth security remain in the no-deploy CI workflow.

### Owner-run acceptance after source CI passes

1. On authorized staging or local emulator, start with a newly registered test Tenant; verify signup anniversary, configured Delivery-only threshold and the first vs subsequent cycle prices.
2. Issue on a *closed Bangkok day*, reissue the same day, and confirm exactly one invoice with the same due date, amount and frozen bank account.
3. Change the platform bank **after** issuance: the existing invoice must still show its original bank. Missing bank snapshot must block a transfer instruction rather than display the new bank.
4. Mark the invoice overdue, upload a slip without approving it: the Tenant must **remain suspended**. Super Admin approval then restores access, and rejection does not count as money received.
5. Disable Hybrid billing for a Tenant, repeat access reconciliation, and confirm a stale caller cannot resuspend it. Confirm POS, Table, Takeaway, walk-in and Lalamove payment flows remain unchanged.
6. Run Owner and Super Admin PC/tablet/mobile UAT yourself and report any mismatches. Source completion/green CI is not permission to deploy or touch real billing records.

**Release state:** PR #8 must remain DRAFT and unmerged; PR #7 is historical. Runtime enrollment/collection switches remain OFF until an explicit owner-approved rollout. Real staging/physical-device and bank-payment confirmation are not claimed from source/CI evidence.
