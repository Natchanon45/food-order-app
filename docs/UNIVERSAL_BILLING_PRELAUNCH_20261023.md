# Universal anniversary billing — prelaunch policy (23 October 2026)

## Decision from project owner

The Firebase project is development/test only: there are **no real customers or real shop transactions**. All existing and future stores must use the **new monthly renewal-anniversary calendar** immediately. Discard the former staged migration/cutover plan and the assumption that a shop must wait for legacy settlement approval, regardless of `billingMode`, `planCode`, `subscriptionStatus` or old `billingAnniversaryEffectiveAt` fields.

The owner will manually remove selected old test transactions from Firestore. **No deletion or migration of Firebase data was performed by these commits.**

## Universal billing-calendar rules

- Use the store's original activation date as `billingCycleAnchorAt` (new signups store it automatically). Historical store records without it derive from a trustworthy server timestamp via `tenantAnchorDate`, such as `trialStartsAt`, `activatedAt`, or `createdAt`.
- For example: SHOP_1 activated 2026-06-21 has current cycle 2026-10-21 through 2026-11-20, resetting 2026-11-21. SHOP_2 activated 2026-07-04 resets 2026-11-04. SHOP_3 activated 2026-06-22 resets 2026-11-22. These are calendar **calculation** facts, NOT permission to restore a suspended account.
- Day 29/30/31: clamp just that month to its final day, never drift the original anniversary permanently. All dates are Thailand local time (Asia/Bangkok).
- Only paid Delivery merchandise enters the threshold, excluding delivery/shipping fees, invalid/unpaid/cancelled/refunded merchandise and POS. Lalamove dispatch uses prepaid Wallet credit and never adds a second Platform shipping debt.
- `functions/revenue-share.js` now groups current threshold and month reports by store anniversary for every anchored tenant with no `billingAnniversaryEffectiveAt` prerequisite. Empty historical `billingMode` fields no longer exempt eligible stores. A missing trustworthy anchor **must not create a bill**; monthly requests fail closed.
- A daily Revenue Share billing cadence (where currently configured) remains daily; monthly threshold reset is a separate clock from daily settlement. The new Hybrid calculation preview uses activation-anniversary cycles independent of any stored legacy billing mode.

## New unified Hybrid model — status is PREVIEW ONLY

Hybrid's pure calculator models a fixed monthly price below a Delivery threshold, or Delivery percentage once it is reached, with a first-cycle fixed-fee waiver and a central slip quota. This preview is now available to the owner/admin for **all tenant types**, with the starting month derived from activation, regardless of `billingPolicyVersion`.

**Do not mistake universal calendar/preview access for a complete Hybrid billing launch.** `HYBRID_REGISTRATION_READY=false` remains intentionally disabled because secure invoice issuance, verified payment, idempotent debt and suspension/recovery, and quota enforcement are still unfinished. Production operational billing and subscription expiry are NOT silently replaced with Hybrid charges by this patch. The current Revenue Share page is still an operational/legacy report; do not issue payment on both systems. Finish the real ledger and payment workflow before enabling the global Hybrid mode.

## Firestore cleanup boundaries — owner-operated only

Preserve **master/configuration** information, especially tenant identity/name/slug, merchant business type and units, store settings/branding/phone/address, food/menu categories, products, items and stock master, owner/staff permissions that should remain, centrally configured fee/threshold settings, supported fulfillment/provider configuration, and the relations needed to resolve tenant slugs and users. Do not blindly delete a whole `tenants/{id}` document or its subcollections.

Carefully review **test operational/transactional** collections for manual cleanup: draft/completed orders, sales, bill/payment records, test Lalamove bookings/Wallet topups and ledger, daily share payment slips, tax invoices, POS shifts and movement logs. **Do not run blanket collection deletion from this guidance.** Some operational records may also be legally or functionally necessary as opening balances, audit logs or stock movements. Match related transaction references before deletion to avoid orphaned pointers or unintended negative balances.

Firestore documents, Cloud Storage files, Firebase Authentication user accounts, and transaction ledgers can refer to each other. Deleting one does **not** automatically delete the others; clean only what the owner has independently verified as test records. The assistant has not generated nor executed any bulk-delete script.

## Verification / deployment status

- Commit code only to `feature/react-firebase-port`. Do not reset/clean the Mac's uncommitted generated HTML/assets.
- Run `npm run test:billing-anniversary`, `npm run test:hybrid-billing`, `npm run test:revenue-payment-bank-picker`, and `npm run test:react-parity` on the Mac.
- Test the `/reports/hybrid-billing` read-only preview for each anonymous sample store and verify distinct start/end dates, February clamping and threshold reset.
- No Firestore writes, deletions, CLI cutover authorizations, or Firebase production deploys performed by these code commits.
- The previous `tools/plan-billing-anniversary-cutover.mjs` and historic cutover audit are retained for reference only: its old `BLOCKED_REVIEW` classifications **no longer determine the activation-anniversary calendar**. Do not use them to decide which tenant receives the universal new policy.

## IconPacks

The optional replacement-icon plan in `docs/BILLING_ANNIVERSARY_AND_ICONS_20261023.md` remains a later UI design task; no icons have been downloaded or replaced in this billing update.
