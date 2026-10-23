# PENGUIN Hybrid Billing — phase 2 read-only candidate (.526)

Status: **NOT PRODUCTION-READY, DO NOT DEPLOY**. This repository contains the isolated billing calculator, trusted paid Delivery sales reader, a read-only authenticated monthly report, Super Admin settings and React registration candidate. Registration is deliberately **fail-closed** while server-side invoicing, confirmed payment review, access suspension and slip quota are unfinished.

## Confirmed user rules

- User chooses Restaurant/Delivery, Retail POS, or Both, not a monetary billing model.
- Only one fee model per tenant anniversary billing cycle (activation day through the day before the same date next month): flat monthly if Delivery is below the dynamic threshold at cycle close; otherwise percentage of paid Delivery merchandise sales. POS is excluded. First month waives the flat fee, not Delivery share.
- Trigger day: immediately charge only `deliveryThreshold * deliveryShareRate / 100` even if actual cumulative Delivery sales exceed the threshold. Same-day overshoot is never billed a second time. Each subsequent day until anniversary-cycle close: percent of that day's new Delivery sales.
- Unpaid daily invoice on day D suspends account starting day D+1. Settled invoices require trusted server confirmation, not a slip upload alone. Unpaid balance survives anniversary reset.
- Before threshold: `monthlySlipQuota` per tenant anniversary cycle; at threshold: unlimited product entitlement, subject to provider technical limits.
- `monthlyFee`, `deliveryThreshold`, `deliveryShareRate`, `monthlySlipQuota` are controlled by Super Admin, never customer supplied. Currency THB; billing day and month Asia/Bangkok.
- Every store now uses the activation-anniversary calendar and may open the **read-only Hybrid preview**, regardless of old billingMode. Existing operational invoices and access statuses are not changed automatically; the new Hybrid payment engine is not launched.

## Implemented candidate (phase 1 only)

- `functions/hybrid-billing-core.js`: pure calculator, day boundaries, deterministic invoice keys, overdue identification, input validation; **no Firestore writes**.
- `functions/hybrid-billing-settings.js`: public sanitized pricing callable and super-admin-only view/update for `platformSettings/hybridBilling`. Initial defaults are 590/10000/5/100 but are editable. `HYBRID_REGISTRATION_READY = false` deliberately prevents new policy registration.
- `functions/public-signup.js`: new Premium tenant activation now records a stable server-side `billingCycleAnchorAt` and `billingAnniversaryEffectiveAt`; historical Hybrid registration remains disabled. Currently signup/activation for new hybrid is rejected until rollout guard is enabled. Legacy pending subscriptions can still activate.
- `functions/subscription-admin.js`: skips `hybrid_v1` tenants so subscription expiry scheduler cannot overwrite hybrid states. Legacy tenants retain legacy mode.
- `react-app/src/pages/RegisterPage.jsx`: service-only choices; dynamic pricing disclosure; no subscription/revenue share/yearly billing choices; no stale fallback pricing, and submit unavailable until server reports readiness.
- `react-app/src/pages/PlatformPricingPage.jsx`: new Super Admin editor with four hybrid prices. Existing legacy Premium pricing editor intentionally retained for existing customers.
- `react-app/src/i18n/parity-translations.json`: 5-locale messages added (Myanmar, Lao and Khmer key paragraphs need native linguistic QA before go-live).
- `tests/react-parity/hybrid-billing.spec.mjs`: pure calculator and wiring regressions; wired to npm parity scripts. Updated older signup test for new policy.

## Still required before enabling registration or providing Firebase production deploy commands

1. Trusted server accounting aggregate from paid Delivery orders only, with refunds and shipping exclusion, timezone-safe per-period immutable snapshots and idempotent issuance when crossing threshold; handle concurrent payments, duplicate events and settings edits.
2. Persist invoice ledger, client-visible list and billing payment UX, Slip2Go verification and Super Admin review with secure Firestore rules; approve/reject/unlock audit, no duplicate processing.
3. Next-day suspension and safe payment-only access during suspension. Keep past months' debt. Ensure scheduled reconciliation and payment review do not conflict with existing subscription/revenue share guards.
4. Strict monthly Slip2Go verification entitlement count and proper provider-credit fallback.
5. First trial billing cycle now means the tenant's first **activation-anniversary cycle** (confirmed 2026-10-23). Still define handling of partial refunds/chargebacks, awaiting-verification deadline, fixed fee due date, and what counts as slip usage.
6. Staging Firebase Emulator + mobile/desktop UAT + backend callable permissions tests + live-safe migration plan and coordinated Functions/Hosting/Rules deployment approved by user.

## Safe commands for source testing (NOT production deployment)

```bash
cd /Users/natchanonsripleng/Desktop/Sites/food-order-app
git pull --ff-only origin feature/react-firebase-port
npm run test:react-parity
npm run verify:react-build
```

**Do not run `firebase deploy` yet.** Candidate registration is fail-closed and has no operational payment engine. Production Hosting remains Version 0.4.294 Build 2026.10.18.524.


## Phase 2 progress — 2026-10-19 / candidate Build .526

- `functions/hybrid-billing-orders.js`: trusted server-side paid Delivery mapping, requires `orderType=delivery`, `paymentStatus=paid`, Firestore Timestamp `paidAt`; ignores non-Delivery and unpaid orders; excludes shipping, cancelled/refunded and deducts partial refunds; fails closed for malformed payment data.
- `functions/hybrid-billing-preview.js`: callable `getTenantHybridBillingPreview` for tenant owner/admin (or Super Admin explicit tenant); paginates Firestore `tenants/{id}/orders` by authoritative `paidAt` timestamp for Bangkok month; enforces tenant boundary; maximum scan 50,000 paidAt documents to fail rather than show incomplete fees. Reads immutable `hybridBillingPeriods/{YYYY-MM}.configSnapshot` if present; otherwise estimates using first-month signup snapshot or live admin settings. **Read only**; does not issue invoices, mark paid or suspend.
- Frontend: `/reports/hybrid-billing` new Read-only report accessible from Hybrid tenant Home Dashboard; displays Delivery sales, configured threshold, fee mode, fee estimate, month invoices projection, quota entitlement. New physical HTML entrypoint in Vite sync and parity route registry. All UI explicitly states **this is not an invoice/payment receipt**.
- `react-app/src/auth/tenantAccess.js`, `react-app/src/app/App.jsx`: if future `hybridBillingSuspended` flag is true, owner/admin retains billing report access and is redirected from operational routes, while non-billing staff is denied; ordinary admin-disable remains denied. Legacy subscription/revenue share paths unchanged. **No writer currently changes hybridBillingSuspended**.
- Tests `tests/react-parity/hybrid-billing-orders.spec.mjs` and `hybrid-billing-report.spec.mjs` added and wired to full npm parity suite; pure calculator/sales/preview/UI-access suite runs **34/34 PASS** before final full parity checks.
- New-chat continuation prompt: `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`. Use this before asking the user to repeat requirements.

**Unfinished and non-negotiable release gates:** This remains a candidate only, because immutable issued invoices, real day-close settlement, bank slip/Slip2Go verification, manual approval, payment arrears, idempotent suspension/recovery, true Slip2Go verification quota, Rules / Storage and end-to-end UAT are not implemented. `HYBRID_REGISTRATION_READY=false` must stay false. Do not deploy Hosting or Functions to production until those exist.

## 2026-10-23 anniversary change (candidate, no production deployment)

The monthly calculator now provides `calculateCycle` for tenant activation-anniversary windows while keeping `calculateMonth` as a backwards-compatible calendar-month wrapper. `hybrid-billing-preview.js` obtains `tenantAnchorDate` from the server-recorded activation, calculates cycle start/end via `billing-anniversary.js`, and reads only paid Delivery orders within that span. Invoice IDs use the cycle start date; the February clamp never drifts an original day-29/30/31 anchor. The UI displays explicit cycle boundaries.

The existing hybrid registration gate remains disabled. All production cutover details and IconPacks design phase are in `docs/BILLING_ANNIVERSARY_AND_ICONS_20261023.md`. These changes were committed on GitHub only and **have not been deployed**.

## Owner update 2026-10-23 — apply NEW calendar universally (prelaunch)

All stores (including ones with empty `billingMode`) now use activation-anniversary monthly threshold periods. The read-only Hybrid estimator is accessible for all tenant owners/admins, even when their old tenant record is not marked `hybrid_v1`. The **billing engine is still preview-only** and `HYBRID_REGISTRATION_READY=false`; secure invoice issuance and payment state must be completed before changing every store's operational charge model. The former migration/cutover plan is superseded. See `docs/UNIVERSAL_BILLING_PRELAUNCH_20261023.md`. The owner handles deletion of selected test transactional data, not the assistant.
