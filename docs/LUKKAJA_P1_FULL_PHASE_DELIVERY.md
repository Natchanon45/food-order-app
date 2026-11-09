# PENGUIN ← LUKKAJA — Phase 1: Super Admin / Platform, single acceptance unit

**Source (read-only):** cosmatch/lukkhaja @ feature/react-golang-vite-tailwind-axios
pinned e84c899028eb16c67401dcc05c5faed84bf48f63.

**Target:** Natchanon45/food-order-app @ feature/react-firebase-port.
**Policy:** Work on GitHub, pull to Mac for verification, deploy only the single Firebase Hosting URL https://penguin-food.web.app after the **entire Phase 1** passes. Never merge into main without explicit instruction; never update the LUKKAJA source.

## One delivery, not multiple release slices

Phase 1 is **not complete** until each of these 7 pages is visually and operationally compared against the pinned source and any new Firebase write flows pass authenticated demo Emulator and operator UAT:

| Page | Current code status | Still required to claim full Phase 1 |
|---|---|---|
| PlatformPage | Read/error guards adapted to Firebase; 0.4.305 prior incremental Hosting already live | Signed-in Super Admin browser/permission/provider read-failure and successful write verification |
| PlatformOwnersPage | Source JSX imported; create/edit owner re-read confirmation and first activation plan | New-store all-in-one user experience, error retry/idempotency and Auth+Firestore recovery UAT |
| PlatformContactPage | Source JSX and Telegram platform panel imported to candidate | Firebase encrypted Telegram provider test + real outcome notification events; signed-in contact/Google settings UAT |
| PlatformPricingPage | Source JSX imported with monthly Slip2Go quota configuration | Test documented service policy vs real provider quotas, authenticated pricing UAT and server enforcement |
| AdminTenantsPage | Existing Firebase actions retained, first-activation date and provisional owner status surfaced | Source TenantControlPanel and M7 financial/status/owner layout, verified backend adapters, account/finance access guard UAT |
| AdminUsersPage | Source JSX and scoped CSS imported; Firebase staff contract checks current tenant | Auth Emulator role / cross-tenant CRUD browser UAT; exact desktop/mobile visual comparison |
| SaasSetupPage | Existing Firebase migration UI and protected callables retained intentionally | Compare inspection flow to Go source and retain existing Firebase migration functionality with cross-tenant tests |

The source Go/MySQL M7 ledger, COD reconciliation, Telegram event notifications, and one-shot create-tenant-with-owner server action have **no proven identical Firebase implementation** at this checkpoint. Do not present a read-only shell, calculated preview, or unverified ledger value as a live issued invoice or a successful payment.

## Safety and billing

- A Superadmin-created tenant is initially **inactive and onboardingRequired**, so no storefront can accept orders until the owner is successfully provisioned.
- Owner creation chooses monthly/yearly before switching the tenant active, writing firstActivatedAt and the free-month calendar policy; older tenants must not be retrialed.
- The two existing Firebase operations are **not atomic across Auth and Firestore**. If owner creation fails or a timeout is ambiguous, the provisional tenant stays unavailable and must be reviewed in /platform/owners. Do not auto-resubmit or silently delete an uncertain Auth/tenant record.
- Monthly subscription and Slip2Go quota fields are configuration; merely showing them does **not** activate new automatic charging, suspension or unlimited quota.
- Telegram Bot tokens must never be sent back to Browser; candidate platform implementation requires a server-side encryption secret and provider UAT before it may be deployed.
- Never deploy Functions, Firestore Rules or billing jobs to production without demonstrably passing synthetic Auth/Firestore Emulator tests, role scoping, duplicate payment/credit safeguards and corresponding approval.

## Acceptance gate (not yet met)

1. Port and verify **all seven** JSX routes/associated components/style sheets from pinned source in one target branch.
2. Complete Firebase adapters for all user-visible read, save, create, update, delete, approval and retry actions; fail closed without verified underlying data.
3. Automated unit/contract tests; full React Parity; Vite build and file-integrity gate.
4. Synthetic Auth/Firestore Emulator: first signup, manual Owner provisioning, role isolation, subscription trial timing, suspend/reactivate, payment review, M7/COD safety.
5. Signed-in browser comparison with source at desktop, tablet, mobile; smoke and UAT for actual tenant data and failed provider responses.
6. Only then commit a release candidate, pull the exact HEAD to Mac, deploy Hosting/Functions/Rules required in a staged and reviewed order, check the live JS hash and URL. No main merge.

## Checkpoint 09/11/2026: engineering in progress, not a Phase 1 delivery

Existing verified **live** release remains 0.4.305 at https://penguin-food.web.app, generated asset index-CoVwNJEQ.js, from commit fb3d249f. Newly ported source UI and Firebase adapters in this checkpoint have **not been deployed**. The user requested completion of Phase 1 as a whole, not acceptance of partial checkpoints.

Checks so far on candidate: full existing React Parity PASS; Vite build PASS; 6 source/new-store calendar and credential-visibility contract tests PASS. No authenticated Tenant/Platform provider UAT or one-call provisioning release sign-off; no production tenant or finance mutation.

## Firebase production deployment checkpoint — 09/11/2026 (explicit owner request)

The user explicitly requested deployment before the entire Phase 1 was accepted. This is a **deployed in-progress checkpoint, NOT a Phase 1 completion certificate**.

- Source + generated Hosting bundle: commit `e42bc4398f16908f5b76d2bc1ac2a946e4e69424` on `feature/react-firebase-port`, without merging `main`.
- Firebase project `chat-45754`, single Hosting site `penguin-food`: https://penguin-food.web.app.
- Hosting runtime entry `index-BaKCYABy.js`, sha256 `d3ecef416b01486740e9bbbffb67935cb184d6a326533a752beb42d3f5d8402e`; seven scoped page routes serve it, matching the locally built JS bytes exactly. Both imported scoped CSS files also match server bytes.
- Scoped Cloud Functions deploy: createTenant, createTenantOwner, listTenantStaff, createTenantStaff, updateTenantStaff, getPublicSubscriptionPricing, getSubscriptionPricing, updateSubscriptionPricing, initializeTenantSubscription, backfillTenantSubscriptions, syncExpiredTenants, getPlatformTelegramSettings, savePlatformTelegramSettings and testPlatformTelegramSettings. All fourteen functions reported successful deployment; no other Finance/Delivery functions, Firestore rules or Storage rules redeployed.
- Secret Manager: `PENGUIN_TELEGRAM_ENCRYPTION_KEY` created with version 1; its plaintext is not stored in Git or this log. Auth-less POST to `getPlatformTelegramSettings` returns HTTP 401. The bot token and Chat ID are **not yet configured by the operator** and Telegram outbound event notifications have not yet been wired/verified end to end.
- Validation: React Parity PASS, generated Hosting contract PASS, P1 Owner/Staff Auth+Firestore Emulator PASS, actual Delivery Share Auth+Firestore+Storage Emulator PASS, source integrity tests PASS.
- Known unrelated red test: legacy `tests/firebase-emulator/hybrid-finance-security.spec.mjs` currently reports 23 pass / 1 fail in an invoice writer assertion at exact 10,000 threshold (expects an invoice before month close). No changed code touches Hybrid invoice writer or the failing test. It has **not** been marked passing or used as evidence of Finance acceptance.
- Outstanding before declaring Phase 1 complete: complete source TenantControlPanel/M7 and single-call tenant+owner provisioning parity, provider event notifications, actual authenticated browser UAT at desktop and mobile, configuration/usage enforcement for Slip2Go quota and other acceptance checks enumerated above.

## Phase 1 continuation — integrated source Tenant Control and one-call owner provisioning (09/11/2026)

**Not a release.** This continues the same seven-page Phase 1 acceptance unit; no source LUKKAJA edits, no main merge and **no further Firebase Production deploy** in this checkpoint.

- Copied source `TenantControlPanel.jsx` (source JSX structural sections, summary, module access, membership, account and actions) and its 514-line stylesheet to PENGUIN; preserved the existing PENGUIN `TenantCard` actions inside the source component's advanced tools and surfaced production notification chips in the header.
- Imported pure read-only source `tenantActivationCalendar.mjs` and `tenantAccessReason.mjs`; formatted `firstActivatedAt` in Bangkok time, masked recorded store bank/PromptPay account identifiers, and marked Lalamove wallet read readiness from an actual Firestore settings document.
- **M7 / SQL certification is not migrated:** the source financial ledger, COD reconciliation and test override components do not have verified matching Firebase records or Callables. The new source card shows `unverified` and **does not synthesize** Invoice, Service Credit, pending debt, COD, provider quota, or authorization to collect money.
- Ported the source three-step store / Owner / membership form (business, Owner, plan), with an idempotent `operationId` and a new Superadmin-only `createActiveTenantWithOwner` Firebase Callable. Server reserves slug and request atomically, validates central pricing, creates Firebase Auth Owner and commits tenant, settings, membership and trial in a Firestore transaction. On failure, re-reads evidence, compensates uncommitted Auth and releases only proven uncommitted reservations; ambiguous cases remain locked for review. Legacy `createTenant` also now uses a slug-unique transaction.
- On success, the UI independently re-reads canonical tenant data; if a transport failure leaves the result uncertain, it blocks blind resubmission. Only definitive duplicate rejection permits corrected input with a new operation ID.
- **Tests completed:** one-call Auth/Firestore Emulator **5/5**, new source Tenant Control/finance safety contracts **4/4**, source/onboarding preexisting Firebase Emulator **1/1** (included in the five), full React Parity PASS on the preceding UI commit, Vite Build + generated contract PASS, anonymous Vite/browser protected-route check **17/17**. All Emulator tests used `demo-penguin-hybrid`, never real shop data.
- **Still required before declaring the complete Phase:** backend-certified source M7 invoice/COD/credit/outage review equivalence; Telegram event delivery beyond settings/test; Slip2Go quota enforcement; signed-in browser layout/action comparison with source on desktop/mobile; complete UI and authorization tests for seven routes, including SaaS Setup.
- The current user-facing Firebase Hosting is **still** the earlier Build `index-BaKCYABy.js` from `e42bc439`. This source checkpoint is on `feature/react-firebase-port` only.

## Phase 1 integrated safety and browser checkpoint — 09/11/2026

**Checkpoint only; the seven-page Phase 1 is still an undelivered single acceptance unit.** Changes committed only to `Natchanon45/food-order-app` branch `feature/react-firebase-port`; the pinned `cosmatch/lukkhaja` source branch and `main` are untouched. Firebase Production remains at the earlier release Build `index-BaKCYABy.js` (`e42bc439`); the new Callable, trigger and source Tenant UI **are not deployed**.

### Source JSX/UI
- Source `TenantControlPanel.jsx` and its CSS now own one visible tenant identity/summary/module/registration/finance evidence layout. The former nested duplicate PENGUIN `TenantCard` was removed; only remaining Firebase-specific Owner onboarding, Revenue Share release and subscription maintenance actions are retained in the source advanced-tools slot.
- First-activation date appears on the header of every source tenant card, using `firstActivatedAt` normalized in Bangkok; absent values are not fabricated. Store payment account identifiers are masked in a Superadmin-only callable response. The existing public store settings Firestore Rules have **not** been changed; the masking protects this new Superadmin UI response, not all existing public checkout/store-settings reads.
- Three-step source-style create-store form supports one-call Firebase Auth/Firestore Owner+store provisioning, validates central pricing, reserves slug and idempotency key, and performs conditional rollback on failure.

### Finance safety
- New `finance-manual-review-policy.js` enforces Superadmin manual approvals **server-side** only for explicitly supported Slip2Go technical failures, with provider/status/code/reason/fallback validation. Unknown, duplicate, mismatched, rejected, date-mismatched, unverified and Vision-only receipts may not be approved using the fallback.
- Wallet approval checks eligibility **inside the credit transaction**. Revenue Share approval checks eligibility before amount reconciliation and again inside its transaction, preventing stale state approval. Rejection remains possible without crediting the wallet.
- Auth+Firestore Emulator confirmed that mismatched Wallet and Revenue Share receipts cannot be approved; no wallet-credit mutation takes place on rejection; a legitimate technical failure permits one Wallet credit, never replayed.

### Telegram finance notices
- Source-derived global Superadmin Telegram channel semantics were added to a pending Firestore outbox for **committed** Lalamove Wallet and existing Revenue Share payment records: verified, rejected, technical-review, unverified-pending and reviewed outcomes.
- Outbox entries use a deterministic per-tenant/receipt/outcome event ID; a channel enabled check; an at-most-once automatic dispatch attempt; and a terminal `unconfirmed` state when provider delivery was ambiguous. Failed notification attempts cannot alter payments or holds. Text contains only tenant reference, document reference, amount and status; no bank accounts, receipts, payer identities or bot token.
- This covers these two **existing Firebase channels only**. LUKKAJA's certified M7 monthly/yearly/daily invoice notifications **have not been ported**. The live Telegram Bot send, owner-configured credentials and Eventarc production triggers remain unverified and **not deployed**.

### Verification
- Combined Auth+Firestore Demo Emulator suite: **12/12 passed** including provisioning, scope, masked bank read, slip guard and outbox; no production database mutation.
- React contract tests: **17/17 passed**, P0 action and React foundation contracts PASS; the complete `npm run test:react-parity` passed after updating only the test harness references moved to the source component and adding the new pure finance helper.
- `npm run build:react` and generated bundle contract PASS, output `/react/assets/index-D6fXI3zZ.js` in the working tree; this file is **not a Firebase production release**.
- Browser UAT: **2/2 passed** on local Chromium Desktop 1440×900 and Mobile 390×844, with **real Firebase Auth+Firestore Demo Emulator sign-in** and specifically mocked read-only Functions endpoints. Checks: source tenant card, Bangkok activation date, expanded registration/account section, masked bank/PromptPay, and all three steps of the Owner creation dialog. This is **not** proof of live authenticated backend networking or a pixel-perfect side-by-side screenshot comparison with source LUKKAJA.

### Remaining full-Phase blockers
Certified M7 financial ledger, invoice receipts, credit policy, COD reconciliation and test-mode access controls need verified Firebase data models; actual Telegram provider delivery and subscription/Slip2Go quota enforcement need production-safe test acceptance; all other Phase 1 routes require authenticated operation/error-path and direct source UI comparisons; pre-existing Finance Hybrid Emulator red test and Firebase public store-settings read permissions need separate risk assessment before declaring Phase 1 ready. Do not treat a partial UI, provider mock, or uncategorized financial data as acceptance.

## Phase 1 integrated Firebase Invoice source evidence — 09/11/2026

This is **not** completed M7 financial certification. Phase 1 remains **one undelivered seven-page acceptance unit**. No production Finance/Functions/Rules/Hosting or data mutation was performed in this continuation.

- Added read-only `getPlatformTenantHybridInvoiceEvidence` Super Admin Callable and its pure verifier `tenant-finance-source-evidence.js`, backed only by `tenants/{tenantId}/hybridBillingPeriods` and `hybridBillingInvoices`, never SQL or invented records.
- If the tenant is not on verified `billingPolicyVersion=hybrid_v1`, or the indexed period is missing, the response is unavailable rather than zero dues. For supported tenants, only **one latest indexed billing period** is inspected. The server cross-checks indexed IDs against the period's actual invoice query, mandatory stored identity, ledger version, allowed statuses, money bounds and the deterministic invoice signature. Missing, extra, duplicated or forged documents fail closed. Real Hybrid kinds `fixed_monthly`, `delivery_threshold` and `delivery_daily` are supported.
- The result carries `bankSourceVerified:false`, `originalSignupVerified:false`, `canIssueRealInvoice:false`, `canSettleMoney:false`, `canReleaseTenant:false`, and `coverage:single_cycle_only`; it is **not all-period collection coverage**. The UI explicitly labels amounts as **recorded Firebase evidence, not bank-confirmed payment or M7 certified debt**.
- Added the `TenantFinanceSourceEvidence.jsx` read-only panel to the existing source `TenantControlPanel` M7 section with safe loading/errors, a refresh control and guards against stale responses after a tenant switch. It does not feed any unverified amount into the billing/finance Summary Cards.
- Firebase Auth/Firestore Emulator signed document/index/privacy verification **4/4 passed**, including missing/legacy source, signed record, forged signature/status, missing/extra index, threshold-crossing and fixed monthly record. Existing previously verified P1 backend test suites remain separate.
- Full `npm run test:react-parity` PASS; React Build and generated contract PASS (`index-90PZZtd4.js` local candidate only). Authenticated local browser UAT using real Emulator Auth and mocked read-only Callables **2/2 passed** at 1440×900 and 390×844, including the new source Invoice evidence and three-step owner form.
- **Outstanding:** the original Go/MySQL certified M7 ledger and bank-issued/settled invoice reconciliation are not equivalent to Firebase's single-period source evidence. Slip2Go monthly quota enforcement, complete provider Telegram credential/test delivery and all seven authenticated source JSX comparisons are also not yet accepted. Do not deploy or claim the full Phase complete from this checkpoint.

Current live Firebase Hosting remains the preceding verified Build `index-BaKCYABy.js` at `https://penguin-food.web.app`. The current source branch changes **have not been deployed** to Production.

### Hybrid Invoice threshold regression — verified in full Finance Emulator

The former Hybrid Finance Emulator red test has been corrected: its original fixture assumed **one Invoice on exactly 10,000 THB Delivery sales**, contradicting the established 10,000 THB exemption. The test now independently proves that exactly 10,000 THB generates **no Delivery share invoice**, while 13,500 THB creates **one 175 THB invoice** on the 3,500 THB excess at 5%, then confirms idempotent Firestore persistence and that replay preserves the paid state. This changes **only the test fixture and assertions**, not the production fee calculation.

`npm run test:firebase-hybrid-emulator` on macOS with JDK 21 and the isolated `demo-penguin-hybrid` Auth, Firestore and Storage Emulators: **24 passed / 0 failed**, including denial of unauthorized direct writes, cross-channel bank reference claims, invoice immutability and refund safeguards. Expected `PERMISSION_DENIED` log lines are from negative authorization tests; the suite exit code was 0. This removes the earlier known 23/24 regression failure. It **does not authorize** new live invoice issuance, retroactive charges, M7 bank certification or a production finance release.

Full Phase 1 acceptance remains open for certified Go/MySQL M7 financial parity, customer-facing Slip2Go quota enforcement, Telegram provider delivery and final live Super Admin UAT. No new deployment.
