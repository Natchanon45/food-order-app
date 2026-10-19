# PENGUIN Hybrid Billing — phase 1 candidate (.525)

Status: **NOT PRODUCTION-READY, DO NOT DEPLOY**. This repository contains the isolated billing calculation, Super Admin settings and React registration candidate. Registration is deliberately **fail-closed** while server-side invoicing, confirmed payment review, access suspension and slip quota are unfinished.

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
