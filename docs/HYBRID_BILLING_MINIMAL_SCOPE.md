# PENGUIN Hybrid Billing — strictly minimal paid Delivery fee calculator

Updated 2026-10-21 (Asia/Bangkok). **DRAFT/READ-ONLY ONLY. No charge, merge, deploy or automatic Tenant suspension.**

## Scope owner-approved
The sole change is the **Tenant platform fee calculated from paid Delivery goods sales**. Keep existing Cashier, POS, Takeaway, Table, Lalamove, PromptPay/Slip2Go, signup and payment processing exactly as they are.

- Paid Delivery merchandise only, not shipping, POS or other channels.
- Bangkok anniversary from signup request (e.g. 16/10 → 16/11), not calendar month.
- After 10,000 THB is reached: charge 5% of merchandise paid on the **trigger calendar day** and subsequent paid Delivery days, not previous days. Current 590 THB fixed fee when below threshold outside first cycle is a **candidate configuration**, not a production charge authorization.
- Existing Owner/Admin report stays **read-only preview**; the displayed breakdown is not a payable invoice.
- Do not implement global ledger W1-W6, change a payment writer or open more PRs.

## Narrow PR #8 contents
- Pure cycle calculator: `functions/hybrid-billing-core.js`, `hybrid-billing-delivery-only.js`, `hybrid-billing-orders.js`.
- Existing report reader and React report page use selected Bangkok date and anniversary cycle.
- Read existing `publicTenantSignups/{ownerUid}.createdAt` **only** when it belongs to the activated Tenant; fall back to trusted Tenant.createdAt for missing/mismatched older records. No registration writes or changed signup behavior. If a matching record has an unverifiable or post-activation date, fail rather than guess.
- Historical read-only Delivery audit uses existing single-field `orderType == "delivery"` query with cursor pages, bounded at 10,000 Delivery documents total. Paid records with non-Firestore `paidAt` or scan overflow cause explicit preview failure. It does NOT certify all payment writers or transaction consistency; `coverageCertified:false`, `canIssueInvoice:false`.
- Source-only Tests/CI; no Firebase deployment.

## Out of scope / safety boundaries
- `CashierPage.jsx`, `functions/public-signup.js`, `firestore.indexes.json` **restored byte-for-byte from base**. The Hybrid cashier helper/test and unused compound-index addition were deleted.
- Existing cashier Delivery payments can still record an ISO string `paidAt` whereas Slip2Go server-confirmed payments use Firestore Timestamp. The preview **will refuse legacy ISO paid Delivery rows** rather than silently invent a charge. No automatic migration or writer changes in this PR.
- Up to 10,000 total Delivery documents are scanned, not 10,000 paid only. Large Tenant history may fail closed. Current implementation is for safe read-only estimation, NOT production money issuance.
- Fees, historical completeness, real Tenant reconciliation and production billing authorizations remain unverified. User has not authorized merge, deploy or live collection.

## Final acceptance close-out: date-accurate read-only report
- The selected Bangkok report date is now a true **as-of day**: a paid Delivery receipt later in the same anniversary cycle must not alter that day's accumulated threshold, fee, or displayed sales. Query ends at the next Bangkok midnight and the pure adapter independently bounds rows by selected day.
- Rapid report date changes/refreshes invalidate stale requests instead of overwriting a newer selected period. All changes stay inside the pure calculator/preview and existing report UI.
- No changes to payment writers, Cashier, original signup, Firestore index/rules, POS or Lalamove. No automatic money collection or live deployment.

## Final implementation acceptance — completed in this chat, 2026-10-21

**Development scope COMPLETE (source-only, read-only preview).** This is not approval for real-money billing.

| Acceptance requirement | Code/test status |
| --- | --- |
| Paid Delivery merchandise only, excluding shipping, POS, table, takeaway, walk-in | PASS |
| Anniversary 16 Oct → 16 Nov, including short February months | PASS |
| Threshold 10,000 THB; 5% of trigger day and following paid Delivery days | PASS |
| First cycle below threshold free; subsequent cycle under threshold fixed-fee estimate | PASS |
| Selected date shows only receipts through that Bangkok calendar day | PASS |
| Rapid date changes cannot overwrite a newer preview response | PASS |
| No cashier, payment writer, registration, index, rules, POS or Lalamove changes | VERIFIED DIFF |
| All CI tests, React build | PASS |

**Code verified:** `f03b95de1605579e819ec6c46e73c9538cb3e005` — [Push CI 39639426909](https://github.com/Natchanon45/food-order-app/actions/runs/39639426909), [PR CI 39639435825](https://github.com/Natchanon45/food-order-app/actions/runs/39639435825), both SUCCESS. Tests: 30 calculator/adapter + 32 existing contracts + 16 audit = **78 passing, 0 failing**; React build PASS.

**No production certification:** the feature is intentionally an estimated, read-only report. Existing legacy paid Delivery orders containing browser ISO `paidAt` may make the report refuse to calculate. First request dates can have been overwritten by previous registration retries; fallback to verified Tenant creation can differ from first request day. Complete historical data reconciliation, fee-policy confirmation, any charge issuance, tenant payments, access suspension and production rollout are **NOT implemented/authorized**. Do not describe this PR as an operational billing/collection system.

**Final working location:** `Natchanon45/food-order-app`, `feature/hybrid-billing-delivery-only-minimal`, [Draft PR #8](https://github.com/Natchanon45/food-order-app/pull/8) targeting `feature/react-firebase-port` at base `c9aef253e5d8e0953900a8bb34dbb6921ab40357`. PR #7 stays Draft, unmerged and unchanged. This chat is the close-out; no new workstream or new-chat handoff is requested.
