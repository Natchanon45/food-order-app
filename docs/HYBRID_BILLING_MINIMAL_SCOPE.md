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
- The read-only preview now scans at most 3,000 Delivery Order records to detect paid entries with missing or noncanonical `paidAt` before calculating. It fails closed on anomalies or if scan exceeds the cap (no silent undercount); this scan is not a transactionally consistent snapshot or all-writer certification. Large shops need a separately designed efficient completeness mechanism before real fee issuance. No data migration, invoice or suspension is enabled.
- `calculateMonth` now charges 5% only on paid Delivery goods of the trigger calendar DAY, consistent with the later Hybrid prototype. Confirm this business policy before billing real tenants.
- Anniversary billing has been added to the **new read-only preview path** using immutable server Tenant.createdAt (or existing hybridBillingStartDate) and Bangkok date boundaries; the original calendar-month helper remains for old compatibility tests, not invoice issuance. Fee policy, refunds/adjustments, actual charge workflow and payment confirmation still require sign-off. These do **not** justify rewriting the operational payment writers.
- All four readiness flags remain false. No real tenant fee issuance, automatic suspension, merge or Firebase deploy.

## Test plan and acceptance
- Run Node pure unit tests for Hybrid and anniversary Delivery-only adapter; run existing preview/role and bounded completeness-audit tests with Firebase dependencies before UAT.
- Verify tenanted Owner/Super Admin read-only previews against a sample of actual stored Delivery orders, without modifying data.
- Preserve all existing workflows; only after sample totals match and fee rules are approved, introduce a small separately reviewed tenant-fee record/payment flow reusing the legacy platform billing controls.

## Reusable handoff
Repository `Natchanon45/food-order-app`. Base `feature/react-firebase-port` pinned at `c9aef253e5d8e0953900a8bb34dbb6921ab40357`. Active minimal branch `feature/hybrid-billing-delivery-only-minimal`. Historical Draft PR #7 `feature/hybrid-billing-github-first` stays DRAFT and unmerged; do not copy its all-writer finance architecture. Continue minimal read-only billing validation, then authorize charge rules and low-impact integration. Before a future handoff, record current HEAD, code commit, CI, completed/open changes, restrictions, and next steps and repeat this handoff instruction.
