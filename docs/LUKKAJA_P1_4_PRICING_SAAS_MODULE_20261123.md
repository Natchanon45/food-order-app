# P1.4 — Pricing and SaaS Setup | JSX → Firebase Module Closure

**Development date:** 2026-11-23 (Asia/Bangkok)
**Target:** `Natchanon45/food-order-app` / `feature/react-firebase-port`, based on `04d76db92cd610c65594cff94b3ff1d4dc324e33`.
**Source, strictly read-only:** `cosmatch/lukkhaja` / `feature/lukkaja_bankalert_stripe@8b108f1278b7c59bd44c02133d659b8e6cd6fd3f`.
**Status:** **P1.4 SOURCE-ALIGNED, COMPLETE AT LOCAL CODE + FIREBASE EMULATOR + SIGNED BROWSER AUTOMATED ACCEPTANCE. NOT PRODUCTION DEPLOYED OR SIGNED OFF.**

## Module definition and comparison

**Two pages**, both compared against the **pinned remote Source branch** rather than the checked-out (different) local Source branch. No changes were made to the Source:

| Source JSX (lines) | PENGUIN JSX (lines) | Firebase adapter | Backend authority | Parity |
| --- | ---: | --- | --- | --- |
| `PlatformPricingPage.jsx` (461) | 462 | `data/subscriptionPricing.js` | `functions/subscription-pricing.js`, `subscription-pricing-core.js`, `delivery-threshold-schedule.js` | **Complete:** Premium monthly/annual pricing, discount, VAT, Slip2Go quota, Delivery share, pricing preview, original immutable threshold, append-only future threshold schedule |
| `SaasSetupPage.jsx` (152) | 153 | `data/saasMigrationService.js` (now read-only) | `functions/saas-migration.js` (read-only inspect, fail-closed old write Callable) | **Complete:** fixed target Tenant inspection, nullable counts, target existence, settings presence, no migration/overwrite; Source inspection-only behavior restored |

**Important Source distinction:** The pinned LUKKAJA SaaS Setup page explicitly says `sourceInspectable:false`, `migrationEnabled:false`, and offers **no executable migration**. It only inspects a fixed target. The initial PENGUIN adaptation had added multiple destructive steps (prepare/copy/overwrite/settings/finalize), which exceeded Source parity and could overwrite pre-existing tenant/billing state. P1.4 restores Source semantics and adds Backend protection, while preserving already stable PENGUIN branding and Firebase ownership.

## Action families — 13 audited

1. Superadmin opens Premium Pricing, reads authoritative current config and shows form values.
2. Preview recalculates monthly and annual gross/net/VAT, discount, payable before saving.
3. Superadmin edits monthly fee, Delivery share, Slip2Go quota, annual duration, VAT and discount.
4. Reset form defaults without ever overwriting immutable Delivery baseline.
5. Pricing Save validates raw money/quota/period input **before** rounding; writes through Firebase transaction then independently reloads canonical settings.
6. If a write response is uncertain, the UI disables repeat until a fresh page inspection; neither a timeout nor default read is treated as proof of a successful money mutation.
7. Existing Delivery threshold input is read-only, with immutable cents baseline.
8. New threshold schedule allows future effective dates only, uses append-only historical versions, rechecks canonical history and never changes current billing-cycle effective rates.
9. A read failure does not invent historical versions or enable threshold save.
10. Superadmin opens SaaS Setup, inspects the fixed target Tenant only.
11. Missing target shows **unavailable** menu/table/order/settings counts, not fabricated zero values from unrelated Source data.
12. Refresh reads the canonical target; UI displays clear, translated inspection-only status in all five supported locales.
13. SaaS Migration/Overwrite buttons are disabled in the browser and the old Callable rejects **all actions** for every caller, including an active Superadmin, before any business write.

## Pseudocode boundary map — 7

```text
1. readPremium:
   require active Superadmin and verified managed email
   GET canonical platformSettings/subscriptionPricing
   calculate read-only monthly/annual preview; no Tenant invoice write

2. savePremium:
   require active Superadmin + raw numeric validation (2 decimals, integer months)
   transaction reread profile and master
   if old deliveryThreshold != requested baseline: REJECT
   update only allowed Pricing master fields
   client rereads and compares persisted config; uncertain reply => LOCK retry

3. scheduleDeliveryThreshold:
   require Superadmin
   transaction reads immutable baseline + append-only history
   future Bangkok date strictly later than last version; cents must be new
   append 1 version, verify canonical history
   never edit original baseline, prior versions or active billing cycle

4. inspectSaas:
   require active Superadmin, fixed Tenant ID
   if target missing: return null counts + migrationEnabled:false
   if present: count only target menus/tables/orders, read target store settings
   no Source shop migration or invoice mutation

5. migrateLegacySaasStore:
   validate Superadmin authorization
   REJECT failed-precondition: SAAS_SOURCE_MIGRATION_DISABLED_INSPECTION_ONLY
   no write, even for prepare, collection, settings, finalize or overwrite

6. denyWrongRole:
   Owner/Cashier may not load Pricing or SaaS super-admin pages/Callables
   managed unverified Firebase ID token is rejected by P1.3e pre-handler
   preserve public pricing lookup only through its existing public endpoint

7. acceptDemo:
   real signed Firebase Auth, Functions, Firestore and React Chrome
   verify pricing save read-back, locked baseline, SaaS read-only
   inspect no Tenant/Trial/invoice changes, forbid wrong-role pages
   refuse any Production or Staging project and clean temporary configs
```

## Findings fixed

- **High — destructive migration controls exceeded Source parity:** removed the client-side transport `migrateLegacyStore`, removed the actionable React UI and overwrite checkbox. In `functions/saas-migration.js` eliminated old copy/provision/finalize code. Preserved the old exported Callable name for compatibility, but **all actions return `failed-precondition`** for authorized users; unauthorized users are still denied by RBAC.
- **High — misleading inspection summary:** now inspects **only canonical target Tenant** and responds `firebase_target_only`, `sourceInspectable:false`, `migrationEnabled:false`, and `null` counts for a missing target; a missing target cannot return fake source counts. Public/Owner users cannot inspect target.
- **Medium — raw pricing validation could silently round invalid input:** Firebase `validate()` now rejects non-cent prices/discounts/VAT, fractional or out-of-range annual months, invalid VAT-none combinations and invalid quotas/discounts before `normalizePricing()`. This prevents silently accepting malicious or malformed economic payloads.
- **High — lost Firebase update reply could enable an unsafe repeat:** `saveAdminSubscriptionPricing` now distinguishes explicit pre-write Auth/validation/revision rejection from ambiguous network/timeout/internal failures. After an ambiguous result the UI displays `SUBSCRIPTION_PRICING_WRITE_UNCONFIRMED`, disables another Save, and requires a new authoritative page read. The signed Chrome test explicitly intercepts a **successful commit and drops the HTTPS response**, verifies no automatic duplicate write, requires the button to stay disabled, then refreshes and verifies the original committed amount.

- **Preserved:** Firebase normal price read/write and separate append-only Delivery threshold revisions, standard Source pricing form/card/preview layout, existing paid-bill and invoice state, P1.3e common verified-email guard, original Source branding adapted to PENGUIN.

## Local automated acceptance

| Evidence | Result |
| --- | --- |
| Source JSX / no-migration / pricing contract, 5 locales | **6/6 PASS** |
| Real Firebase Firestore Emulator: Price authority/validation, SaaS read-only/deny, immutable Delivery history, payment-history/Stripe regression | **13/13 PASS** |
| Real Chrome + React + Firebase Auth/Firestore/Functions/Storage Emulator: pricing save/reload, **committed-write lost HTTP reply → locked no-repeat → fresh proof**, SaaS missing/present target, Owner redirect, unchanged finance | **1/1 PASS** |
| Actual UI widths (both pages, 320/390/768/1440 px) | **PASS** within signed Browser |
| `npm run test:react-parity` | All commands through `test:lk-shop-firebase` PASS, then **one unrelated Source cleanliness check BLOCKED** at `test:lk-shop-native`: separate `../lukkhaja_bankalert_stripe` checkout has external Android/Go work in progress; **4/5** native checks pass; all remaining parity commands independently PASS (exit 0). Do not claim uninterrupted full-suite PASS |
| `npm run build:react` and generated Hosting Contract | **PASS exit 0** (`2026.11.09.535`, `/react/assets/index-DceNP7X6.js`), build-only `public/**` files restored/removed; no Hosting release |

**Reproduce:** `npm run test:p14-source-contract` and `npm run test:p14-local-acceptance`. The second tool runs **two isolated** Firebase Emulator invocations, separately for 13 backend/regression tests and one real Chrome test, to avoid fixed-target fixture collisions. Uses literal `demo-penguin-hybrid` with Firebase Auth 9099, Firestore 8189, Functions 5001, Storage 9199; does **not** stop another service using port 8080. It selects local JDK21 when available, refuses Production/Staging context, filters error output and deletes its temporary config.

No live Stripe, Telegram, Lalamove, Google OAuth, real emails or financial transfers were triggered; no customer/Production records are copied. The tests use only dummy, isolated Firebase Emulator identities.

### External Source checkout check (not modified by P1.4)

The ordinary `npm run test:react-parity` is serial and includes a prior P1.3 native LK Shop check that inspects **another, independently edited checkout** at `../lukkhaja_bankalert_stripe` using `git status --porcelain`. While P1.4 was running, that checkout contained modified Payment Companion Android and Go files and a pending SQL file belonging to work outside the PENGUIN target. The check requires a totally clean Source checkout and therefore stopped full parity (native `4/5`, only cleanliness assertion failed). The earlier parity groups all passed. P1.4 did **not** mutate, restore or commit those Source files. The remaining `npm run test:react-parity` commands **after** the external cleanliness check were executed separately without changing any test, and passed exit 0. Re-run the untouched full suite only after the separate Source owner completes or relocates the checkout work.

## Release restrictions / next module

**P1.4 is complete at the requested JSX/React/Firebase port module boundary, not a request to turn on billing or migrate shops.** Actual pricing changes must still be signed off against an approved Staging Firebase project and QA identities before coordinated Production Functions/Hosting release. P1.3 Staging Provider UAT remains independently blocked by the missing dedicated Staging project and real QA email/provider approval.

SaaS Legacy migration is **intentionally disabled and not an unfinished P1.4 feature**: the pinned Source has no verified source access and explicitly disables migration. A future migration would be a distinct high-risk project requiring source/target reconciliation, immutable backup, dry-run, idempotency, explicit import scope and operator approval.

**Never deploy Production Firebase, merge into `main`, issue or mark invoices paid, import Source shops, send real emails, or build an APK/IPA without separate authorization.** The module’s next independent JSX page family should be planned only after confirming the next Source/Target page tree and branch pin.
