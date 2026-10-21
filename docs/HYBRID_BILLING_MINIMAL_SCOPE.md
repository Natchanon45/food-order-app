# PENGUIN Hybrid Billing — Minimal Change, Delivery-only

Updated 2026-10-21 (Asia/Bangkok). **SOURCE-ONLY, preview only, not for production billing yet.**

## Decision
The change is the **platform fee charged to a Tenant based solely on paid Delivery goods sales**, not a replacement for customer payment, cashier, POS, bank, Lalamove or tenant administration. Build from `feature/react-firebase-port`; leave Draft PR #7 (the larger finance-journal design) unmerged and untouched. This small branch/PR deliberately excludes W1–W6 global writer/refund/remittance systems.

## Existing components reused
- `functions/hybrid-billing-core.js`: original calendar-month 590 THB fixed / 10,000 THB paid Delivery threshold / 5% share, first-month trial and slip quota defaults. **No recalculation policy changes here.**
- `functions/hybrid-billing-orders.js`: only paid Delivery goods, excluding shipping, POS, table, takeaway, canceled and refunded sales.
- `functions/hybrid-billing-preview.js` and current Owner/Admin read-only report page: still preview only, no automatic charge or access suspension.
- Legacy `functions/revenue-share-policy.js` already supports `delivery_only`, without changing existing POS / cashier paths.

## Change in this PR
1. Small pure `previewDeliveryOnlyMonth` adapter provides one explicit read-only seam between existing orders and current billing calculator, used by the existing preview callable.
2. Reject a refund larger than the original paid merchandise instead of silently treating it as zero.
3. Align the threshold-day calculation to the original later approved pure rule: 5% of Delivery goods sold on the trigger DAY only, not 5% of the accumulated 10,000 THB threshold and not backdated to prior days. Keep the rest of the original calendar-month candidate unchanged.
4. Automated tests establish that non-Delivery channels cannot affect threshold and that missing trusted payment timestamps do not become guessed sales.

## Non-goals and outstanding verification
- No modification to retail POS, table/takeaway, cashier, Lalamove, Firebase Rules, live payments, tenant memberships, registration flags, or production deployment.
- The read-only preview now scans at most 10,000 paid Delivery Order records to detect paid entries with missing or noncanonical `paidAt` before calculating. It fails closed on anomalies or if scan exceeds the cap (no silent undercount); this scan is not a transactionally consistent snapshot or all-writer certification. Large shops need a separately designed efficient completeness mechanism before real fee issuance. No data migration, invoice or suspension is enabled.
- `calculateMonth` now charges 5% only on paid Delivery goods of the trigger calendar DAY, consistent with the later Hybrid prototype. Confirm this business policy before billing real tenants.
- Anniversary billing has been added to the **new read-only preview path** using immutable server Tenant.createdAt (or existing hybridBillingStartDate) and Bangkok date boundaries; the original calendar-month helper remains for old compatibility tests, not invoice issuance. Fee policy, refunds/adjustments, actual charge workflow and payment confirmation still require sign-off. These do **not** justify rewriting the operational payment writers.
- All four readiness flags remain false. No real tenant fee issuance, automatic suspension, merge or Firebase deploy.

## Test plan and acceptance
- Run Node pure unit tests for Hybrid and anniversary Delivery-only adapter; run existing preview/role and bounded completeness-audit tests with Firebase dependencies before UAT.
- Verify tenanted Owner/Super Admin read-only previews against a sample of actual stored Delivery orders, without modifying data.
- Preserve all existing workflows; only after sample totals match and fee rules are approved, introduce a small separately reviewed tenant-fee record/payment flow reusing the legacy platform billing controls.

## Reusable handoff
Repository `Natchanon45/food-order-app`. Base `feature/react-firebase-port` pinned at `c9aef253e5d8e0953900a8bb34dbb6921ab40357`. Active minimal branch `feature/hybrid-billing-delivery-only-minimal`. Historical Draft PR #7 `feature/hybrid-billing-github-first` stays DRAFT and unmerged; do not copy its all-writer finance architecture. Continue minimal read-only billing validation, then authorize charge rules and low-impact integration. Before a future handoff, record current HEAD, code commit, CI, completed/open changes, restrictions, and next steps and repeat this handoff instruction.

## 2026-10-21 follow-up — Anniversary and completeness verification
- Runtime preview is tied to a Tenant trusted start day, either `hybridBillingStartDate` if explicitly provided or the existing server-owned `createdAt` activation timestamp. **Activation date may differ from the original registration request date**; this policy choice must be confirmed before real billing. No live Tenant data was altered.
- Read-only audit detects missing/ISO `paidAt` on currently paid Delivery orders, bounded at 10,000 paid Delivery records to avoid unbounded reads. Above the limit, or on malformed timestamps, the preview errors rather than returning an incomplete amount. No global consistent snapshot or financial-source certification is claimed.
- Source-only unit tests now cover anniversary 16th/31st transitions, Thailand midnight, cross-cycle exclusion, partial refunds, malformed timestamps, and audit caps. Old POS / Lalamove and other transaction routes are unchanged.
- All readiness flags stay disabled. PR #8 remains DRAFT; PR #7 retains its historical archived proposal and stays DRAFT/unmerged.

## 2026-10-21 continuation — Canonical request-day signup anchor
- The first accepted Hybrid registration request now stores a **server-derived Bangkok `hybridBillingStartDate`** in `publicTenantSignups/{uid}`. Repeated requests re-read that pending document inside the existing Firestore transaction and preserve the original anchor (or recover the previous trusted `createdAt` for earlier pending records).
- On email-verification activation, this one date is copied to new Tenant and Owner profile; previously established trial/business fields remain. The registration readiness flag remains **FALSE**, with no production registration/deploy, no cashier/POS modification.
- For already-created tenants without a `hybridBillingStartDate` the preview still falls back to their trusted Tenant `createdAt` date. Such tenants require a one-time business reconciliation of request vs activation dates; no automatic retroactive change is made.
- The Delivery completeness audit keeps the exact-case Firestore `orderType == delivery` constraint plus in-loop case-insensitive defensive checks. The bounded scan is **not** a certificate of perfect source coverage; atypical legacy type encodings remain a documented data-quality risk.
- Retries after activation are now rejected before re-writing the pending registration; an active Tenant cannot accidentally be moved back to `email_verification_required`. The original activation callable retains its idempotent active-tenant response.

## 2026-10-21 follow-up — Paid-only indexed coverage audit

- **Audit query narrowed** to `tenants/{tenant}/orders` where `orderType == "delivery"` AND `paymentStatus == "paid"`, ordered and paginated by document name. This avoids scanning the much larger population of unpaid Delivery submissions and paid POS/table/walk-in orders. Add a single compound Firestore index for `orders(orderType, paymentStatus)`; it is **source-only and has NOT been deployed**. A missing live index should fail the preview instead of silently skipping records.
- Read-only cap raised from **3,000 to 10,000 paid Delivery records** with a one-document overflow sentinel and deterministic cursor pagination; a store exceeding this still receives an explicit safe failure. Larger history requires a subsequent incremental/certified approach, not unbounded scans on a user-facing callable.
- Canonical lower-case stored channel and payment fields are required for index match; legacy alternate-case / missing-field paid orders are not certified by this query. The preview explicitly returns `coverageCertified: false` and `canIssueInvoice: false`; **do not charge on this data until source completeness is reconciled**.
- This is NOT a change to the order writer, payments, Lalamove, cashier, POS or business registration flow.

## 2026-10-21 verified existing-writer discrepancy (important business blocker)
Source audit at current base `feature/react-firebase-port` confirms:
- `functions/delivery-slip.js`: successful server Slip2Go verification/manual review writes `paymentStatus: "paid"` with `paidAt: FieldValue.serverTimestamp()`; read-only Hybrid Preview can use these canonical documents.
- `react-app/src/pages/CashierPage.jsx`: `const now = new Date().toISOString(); const patch = { paymentStatus: "paid", paidAt: now }` (Delivery/COD cashier flows). These paid Delivery entries are **ISO strings**, not a trusted Firestore receipt timestamp. The Preview audit intentionally **rejects** them and must not use the browser timestamp as a real-money payment date.
- No Cashier, payment, POS, Lalamove or Firestore Rules writer is altered by this PR. To charge all Delivery merchants accurately, a future *small, separately reviewed server-authoritative timestamp capture at payment confirmation* or audited migration/reconciliation is needed; simply parsing ISO strings in the fee calculator is unsafe.
- New two-filter compound index `orderType + paymentStatus` is configuration-only in PR #8; no index has been deployed. A missing index will cause the preview to error before any money changes.
- Data completeness for canceled/refunded historical paid Delivery, noncanonical channel spelling, and simultaneous in-flight payment writes still require UAT. The current audit remains preview-only and explicitly uncertified; **do not enable billing collection/suspension**.

## 2026-10-21 continuation — Hybrid Delivery cashier paidAt normalization
- Reviewed original `CashierPage.jsx` and `operationalData.js`: `updateOperationalOrder` already writes Firestore server transforms through `setDoc(..., {merge:true})`. For **Hybrid Delivery only**, the cashier-confirmed order payment now passes `serverTimestamp()` as `paidAt` instead of the browser's ISO string. Existing COD settlement/status fields, cashier confirmation dialog/receipt, manual PromptPay approval, Lalamove steps, Takeaway/Table and legacy Delivery still use their original flows and field formats. POS untouched.
- This is only **server-assigned clock time**, NOT independent proof of an authentic or complete payment event. Existing privileged cashier can still update the order under existing Firestore rules; a future authorized, transactional payment attestation is necessary before enabling real Tenant fees. Do not mislabel this as finance-source certification.
- Historical ISO-string Delivery receipts remain unchanged and intentionally cause read-only Preview to fail closed pending controlled reconciliation. No backfill, mutation, new callable, deployment or money movement. Hybrid registration remains disabled and current legacy Tenant behavior is unchanged.
