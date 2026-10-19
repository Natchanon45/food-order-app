# PENGUIN Hybrid Billing — phase 2 read-only candidate (.526)

Status: **NOT PRODUCTION-READY, DO NOT DEPLOY**. This repository contains the isolated billing calculator, trusted paid Delivery sales reader, a read-only authenticated monthly report, Super Admin settings and React registration candidate. Registration is deliberately **fail-closed** while server-side invoicing, confirmed payment review, access suspension and slip quota are unfinished.

## Confirmed user rules

- User chooses Restaurant/Delivery, Retail POS, or Both, not a monetary billing model.
- Only one fee model per calendar month: flat monthly if Delivery below the dynamic threshold at close of month; otherwise percentage of paid Delivery merchandise sales. POS is excluded. First month waives the flat fee, not Delivery share.
- Trigger day: immediately charge only `deliveryThreshold * deliveryShareRate / 100` even if actual cumulative Delivery sales exceed the threshold. Same-day overshoot is never billed a second time. Each subsequent day until calendar-month close: percent of that day's new Delivery sales.
- Unpaid daily invoice on day D suspends account starting day D+1. Settled invoices require trusted server confirmation, not a slip upload alone. Unpaid balance survives month reset.
- Before threshold: `monthlySlipQuota` per month; at threshold: unlimited product entitlement, subject to provider technical limits.
- `monthlyFee`, `deliveryThreshold`, `deliveryShareRate`, `monthlySlipQuota` are controlled by Super Admin, never customer supplied. Currency THB; billing day and month Asia/Bangkok.
- Old Subscription and Revenue Share tenants are NOT migrated silently.

## Implemented candidate (phase 1 only)

- `functions/hybrid-billing-core.js`: pure calculator, day boundaries, deterministic invoice keys, overdue identification, input validation; **no Firestore writes**.
- `functions/hybrid-billing-settings.js`: public sanitized pricing callable and super-admin-only view/update for `platformSettings/hybridBilling`. Initial defaults are 590/10000/5/100 but are editable. `HYBRID_REGISTRATION_READY = false` deliberately prevents new policy registration.
- `functions/public-signup.js`: under the future enabled mode, server ignores arbitrary client pricing/billing choices, assigns `hybrid_v1`, captures settings snapshot and activation calendar month, and uses selected business units. Currently signup/activation for new hybrid is rejected until rollout guard is enabled. Legacy pending subscriptions can still activate.
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
5. Define first month as first **calendar** month (assumption; user must confirm before launch), handling partial refunds/chargebacks, awaiting-verification deadline, monthly fixed fee due date, and what counts as slip usage.
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
