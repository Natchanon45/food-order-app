# P1.3f — Staging Provider UAT Readiness and Real Signed Browser Emulator Test

**Date:** 2026-11-23 (Asia/Bangkok).
**Destination:** `Natchanon45/food-order-app`, `feature/react-firebase-port` (baseline `d8d7354d9ba3afb3a7c548f80a86ce559f3d03bc`).
**Source (strictly read-only):** `cosmatch/lukkhaja`, `feature/lukkaja_bankalert_stripe@8b108f1278b7c59bd44c02133d659b8e6cd6fd3f`.
**Result:** **Real React/Chrome + Firebase Emulator local UAT PASS; Production and independent Staging Provider UAT BLOCKED.** No real emails, staging cloud deploy, Production deploy, main merge or APK/IPA.

## 1. Environment finding — do NOT test against default Firebase Project

The checked-in `.firebaserc` defines only **`projects.default: chat-45754`**, the existing Production Firebase project. There is **no `projects.staging` alias, no verified Staging Firebase Web config and no approved QA mailbox/provider setup**. It would be unsafe to run `firebase deploy` or an actual Firebase email experiment using the repository defaults.

The new **offline** preflight command deliberately reports `status:"blocked"` and exits **2**, without contacting Firebase, retrieving credentials, writing to Firestore, or sending email. Expected blockers today:

- `DEDICATED_STAGING_FIREBASE_ALIAS_MISSING`
- `STAGING_FIREBASE_PROJECT_MUST_BE_DISTINCT_FROM_PRODUCTION`

This is a correctly working release guard, **not a failed unit test**. An explicit future `projects.staging` alias requires a separately created and authorized Firebase project. Never modify the default Production alias to make a test pass.

### Staging build protection

`react-app/src/firebase/stagingConfig.mjs` introduces strict opt-in `VITE_FIREBASE_STAGE=staging` configuration with:

- `VITE_STAGING_FIREBASE_PROJECT_ID` — must be a real non-demo ID distinct from Production.
- `VITE_STAGING_FIREBASE_API_KEY` — public Firebase Web key, must not be the Production Web key.
- `VITE_STAGING_FIREBASE_AUTH_DOMAIN` — exactly `<staging-project>.firebaseapp.com`.
- `VITE_STAGING_FIREBASE_STORAGE_BUCKET` — one of `<staging-project>.firebasestorage.app` or `<staging-project>.appspot.com`.
- `VITE_STAGING_FIREBASE_MESSAGING_SENDER_ID` and `VITE_STAGING_FIREBASE_APP_ID` — must match each other.
- No Production RTDB URL, sender app ID, Auth domain or Storage bucket is inherited.

Missing/invalid values fail **before** Firebase initializes. Reused/HMR Firebase default-app project mismatches also fail closed. The normal Production build path remains unchanged when no Staging selection is made. Staging selection cannot be combined with the doubly opted-in Demo Emulator flags.

**Important:** Firebase Web metadata is not the Admin SDK service credential. Do not commit any Service Account JSON, mail verification links, password-reset OOB codes, real customer data or provider secrets. This module does **not** create a Staging Firebase project or obtain real configuration.

## 2. Reproducible real Browser + Firebase local UAT

**Command:** `npm run test:p13-local-browser-uat`

This runs `tools/p13-run-local-browser-uat.mjs`, which:

1. Refuses actual Staging context or any existing temporary config file.
2. Creates a throwaway Emulator config with the **literal `demo-penguin-hybrid` project**, loopback Auth 9099, Firestore **8189**, Functions 5001 and Storage 9199. Firestore 8080 on the Mac mini is occupied by another service; it is never stopped or reused.
3. Selects the existing Homebrew JDK 21 locally when available (required by the Firebase CLI), without changing macOS global Java settings.
4. Forces both `VITE_USE_FIREBASE_EMULATORS=true` and `VITE_HYBRID_DEMO_PAYMENT_E2E=true`. The demo-only Firestore port override is not honored for a non-demo/Production app.
5. Seeds **fresh isolated** Firebase Auth, Firestore users and one Tenant with immutable Trial/subscription/invoice records; starts the real Functions Emulator and Vite React source with Chrome (Playwright).
6. Blocks all **browser requests to non-loopback hosts**. Uses a local Auth Emulator OOB mailbox for verification, with no real mail service and no Production Firebase user accounts.
7. Runs real UI and native Firebase/HTTPS operations, sanitizes output, fails if Secret Manager was accessed during the test, and removes temporary Emulator configuration in a `finally` block.

### Actual Browser scenarios

| Identity / flow | Acceptance performed |
| --- | --- |
| **Superadmin sign-in** | Real Login form with Firebase Auth Emulator account, routes to `/platform/contact`; role allowed |
| **Public Contact** | Expand original Source layout, read previously seeded Contact via Firestore; save a changed heading and verify the canonical document independently |
| **Google Customer Login** | Expand the original Google card; default disabled; save QA TTL setting to Firestore, independently read back; no real Google OAuth provider is enabled |
| **LK Shop platform** | Collapsed by default; explicit expand loads scoped `getLKShopPairingDevices` Callable; with pilot disabled, no QR/room/device capabilities are minted |
| **Telegram provider** | Card collapsed, lazy-mounted **only when operator expands it**; no platform Telegram/Secret Manager call on Contact page initial load |
| **Managed Owner** | Signed Browser Login to `/admin/users` first redirects to `/verify-account`; native unverified state cannot open protected Tenant or Admin users |
| **Managed Cashier** | Signed Browser Login to `/cashier` also redirects to `/verify-account`; narrow 390 px UI has no horizontal overflow |
| **Actual user-click Auth verification** | Verify page sends one `VERIFY_EMAIL` action to Auth Emulator; test retrieves the one-use code locally, redeems with Firebase Client SDK, then Browser checks and refreshes its own native Firebase token |
| **Post-verification Owner** | Browser opens `/admin/users` and loads the actual Staff Callable; no Admin Tenant role bypass |
| **Post-verification Cashier** | Browser returns to `/cashier`; attempting `/platform/contact` redirects away without rendering Superadmin controls |
| **Finance integrity** | Tenant Trial start/end, subscription expiry and `m7InvoiceUnpaidCents` equal their original snapshot after all UI/verification actions |

The real full-React + native Firebase browser suite **PASS 1/1** (one integrated end-to-end test with the above assertions). It is deliberately separate from the prior P1.3e **signed HTTPS Function Emulator 1/1** and P1.3e combined **34/34** Auth+Firestore+Storage policy tests. It is stronger than the former UI-only mocked browser specs but is **not real Staging or actual inbox delivery**.

### Tests and CLI contracts

| Command | Expected |
| --- | --- |
| `npm run test:p13-staging-boundary` | **6/6 PASS**: fake Web config rejected when unsafe; preserved Demo/Production separation; offline preflight blocked; runner refuses a staging context; default-collapsed providers do not initialize |
| `npm run audit:p13-staging-preflight` | **Exit 2, status blocked** until real Staging alias and valid Web metadata are explicitly configured |
| `npm run test:p13-local-browser-uat` | **1/1 PASS**, including real owner/cashier email verification OOB inside Auth Emulator |
| `npm run test:react-parity` | **PASS, exit 0**; whole project regression, including P1.3f six offline boundary tests |
| `npm run build:react` | **PASS, exit 0**, generated Hosting contract `2026.11.09.535` (`/react/assets/index-BX1V41jH.js`); build-only Hosting output restored/removed, no release |

Observed final local runner result: `P13F_LOCAL_SIGNED_BROWSER_UAT_PASS_NO_REAL_EMAIL`, **1/1 PASS**, **0 Secret Manager attempts**, temporary Emulator config removed. Full React Parity **exit 0**; Build Contract **exit 0**.

No temporary Firebase config, verification OOB codes, screenshots, real QA inboxes, generated HTML bundle or credentials are committed.

## 3. Release gate matrix — NOT yet approved

| Gate | Status | Who / next action |
| --- | --- | --- |
| Complete P1.3a–e local Source JSX, native Auth/Firestore/Storage/Callable checks | **Local-tested** | Existing committed work; this suite provides signed Browser flow |
| One independent Staging Firebase project and alias | **BLOCKED** | Authorized project owner to create/approve, preserving Production default |
| Authorized Staging Web config, Hosting URL, Firebase Auth domains and email templates | **BLOCKED** | Provider/admin configuration; do not guess or use Production values |
| Real QA inbox sending/receiving Password Reset and Email Verification | **NOT PERFORMED** | Explicitly approved QA address and real Staging; provider deliverability/locales/quota |
| Staging signed HTTPS Owner/Staff/Superadmin and browser role/tenant isolation | **NOT PERFORMED** | Deploy Staging only after coordinated authorized approval |
| Actual Google Customer Login OAuth client/domain and Contact preview | **NOT PERFORMED** | Approved Staging OAuth settings and QA account |
| LK Shop native App pairing, room scope, webhooks/Telegram secret providers | **NOT PERFORMED** | Separate provider/device QA; LUKKAJA APK cannot be presumed compatible |
| Public Tax Buyer Lookup HTTP privacy/debug/rate-limit audit | **NOT PERFORMED** | Separate HTTP API security review |
| Finance idempotency, paid/unpaid verification and Billing migration under staging | **NOT PERFORMED** | Test with sandbox data only, no real money |
| Production coordinated React + Firebase Functions + Firestore Rules + Storage Rules + Hosting release | **NOT AUTHORIZED** | Requires explicit go/no-go and rollback plan |

## 4. Approval and rollback protocol for a future Staging rollout

1. Authorize creating/using an isolated Staging Firebase project with separate identities, environment, quotas and test-only data. Add `projects.staging` **only after actual project ID confirmation**, without replacing `projects.default`.
2. Configure Staging Firebase Web metadata and authorized domains; run the **offline preflight** until it reports config-ready. This report certifies only static configuration validity, not provider availability.
3. Obtain explicit permission and QA inboxes for real verification/reset emails, then execute Browser/provider tests against only the authorized Staging URL. Do not log email action codes or Auth tokens.
4. Capture redacted evidence for each role and protected Callable, prove original billing/provisioning invariants and old account compatibility; test cross-Tenant and suspended users.
5. Audit Google OAuth, LK Shop native hardware/rooms and HTTP public services independently.
6. Only after signoff, plan a separate coordinated Production release of Functions, Rules, Storage and React Hosting with verified rollback steps and migration cutover order. Do not merge `main` or deploy in this task.

**Module conclusion:** **P1.3f LOCAL STAGING READINESS COMPLETE; actual Staging Provider UAT and Production signoff remain BLOCKED.** The next work should either obtain a specifically authorized Staging project/QA mailboxes or proceed with the independent P1.4 Pricing/SaaS Source port without claiming P1.3 Production closure.
