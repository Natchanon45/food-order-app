# PENGUIN Hybrid Billing — implementation and release audit

Updated 2026-10-22 (Asia/Bangkok).

## Intended complete workflow

Hybrid Tenant signup (Super Admin rollout switch) → immutable first-request Bangkok anniversary → paid Delivery merchandise-only threshold and fee calculation → closed-day invoice issuance with pricing snapshot → Tenant displays outstanding invoice → uploads bank transfer slip → Super Admin reviews and accepts/rejects → scheduled due reconciliation, suspension on overdue and access restoration after payment → monthly Slip2Go allowance (100 by default), unlimited after Delivery threshold. No POS, Table, Takeaway, Lalamove wallet or checkout commission.

## Current Draft PR #8 source

- Source branch `feature/hybrid-billing-delivery-only-minimal` at `ad8d46cdae82ddc65965dc31c92d4f54bee63840`; pinned base `feature/react-firebase-port` at `c9aef253e5d8e0953900a8bb34dbb6921ab40357`.
- Added an isolated Hybrid invoice lifecycle (`functions/hybrid-billing-ledger.js`), invoice and payment callable exports, separate payment proof storage rules, daily scheduler, tenant invoice list/upload and Platform Super Admin issuer/reviewer/bank details panel.
- Added a Super Admin-controlled runtime signup flag; default OFF, requires bank destination and explicit enable. New Hybrid signup retains its FIRST request date across retries. Newly activated Hybrid Tenants are live only when explicitly enabled global signup has allowed registration.
- Hybrid Delivery checkout from Cashier now writes a Firestore server-assigned `paidAt` in the existing flow. Existing non-Hybrid payment paths and Lalamove fee settlement remain unchanged.
- Hybrid Slip2Go credit usage reserves one unit per order per billing cycle before the provider request; if quota is exceeded or cannot be verified, it routes to the existing cashier manual review. Legacy tenants are unaffected.
- Monetary estimates and invoice issuance exclude non-Delivery or unpaid sales; historical string `paidAt` blocks fee issuance instead of silently charging unknown days.

## Verified source tests

Exact-head [Push CI 39645252136](https://github.com/Natchanon45/food-order-app/actions/runs/39645252136) and [PR CI 39645260144](https://github.com/Natchanon45/food-order-app/actions/runs/39645260144) completed SUCCESS. 31 + 32 + 9 + 16 = **88 node tests PASS, 0 FAIL**; React build PASS. These are source/contract tests, NOT Firebase emulator or real-money acceptance.

## Important release blockers: NOT PRODUCTION-COMPLETE

1. Config snapshot comparison in `issueForTenant` uses `JSON.stringify(locked.data().configSnapshot) !== JSON.stringify(estimate.config)`, sensitive to object field ordering after Firestore serialization. A retry may incorrectly block issuance. This needs field-wise immutable-price comparison and a Firestore integration test.
2. Existing historical Cashier receipts stored `paidAt` as ISO strings. The reader deliberately blocks those; no verified backfill/reconciliation has been run against actual Tenant data.
3. Hybrid Slip2Go credit accounting, invoice-payment transaction, scheduled issuance/reconciliation, Storage Rules and new Tenant registration need full Firebase Emulator end-to-end/UAT tests with authorized sample data; source passing is not proof these are safe to deploy.
4. The current invoice source still has `coverageCertified: false`: an authorized Super Admin attestation permits invoice issuance for an opted-in Tenant, but the source is not independently certified or transactionally immutable. Do not enable automatic real charges until finance data completeness and role enforcement are reviewed.
5. Real recipient bank details and production rollout approval are external requirements. Neither has been provided in this conversation.

**Release guardrails:** PR #8 remains DRAFT, UNMERGED and UNDEPLOYED; new registration remains OFF by default. No live Tenant has been charged or suspended by this chat. Original PR #7 remains separate, DRAFT, unmerged.

**Truthful completion status:** The full workflow is largely implemented in code, but production completion is NOT VERIFIED and these blockers must not be hidden by green CI badges.
