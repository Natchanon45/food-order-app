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
