# Next Chat Handoff — React + Firebase Migration

Updated: 2026-10-03
Project: Food Order / Delivery / Retail POS
Repository: `Natchanon45/food-order-app`

## Read this first in a new chat

Before changing code, read:

1. `README.md`
2. `STRUCTURE.md`
3. `docs/NEXT_CHAT_HANDOFF.md`
4. `docs/WORKLOG.md`
5. `docs/SAAS_MIGRATION.md` only for historical architecture/background

Then inspect the repository:

```bash
cd /Users/natchanonsripleng/Desktop/Sites/food-order-app
git branch --show-current
git log -1 --oneline
git status --short
```

Do not rely on old chat memory instead of these files and current Git state.
## Current repository state

- Active path: `/Users/natchanonsripleng/Desktop/Sites/food-order-app`
- Active branch: `feature/react-firebase-port`
- Staff Shifts implementation commit `52191579 feat: migrate POS staff shifts to React`, corrective visual commit `e4d51e06 fix: finalize POS shifts visual parity`, and confirmation-dialog parity commit `f062ad45 fix: replace POS native confirms with app dialog` are pushed.
- Canonical Products /pos/products is complete on Production Build 2026.10.04.382 via implementation commit `005b7d83` and readiness corrective commit `525fcec0`.
- Canonical Stock Movements implementation commit `0bd89a9a feat: migrate POS stock movements to React` and corrective visual commit `d958d964 fix: finalize POS stock movements visual parity` are pushed.
- Canonical Stock Movements is complete on Production Build 2026.10.04.384.
- Canonical Stock Counts implementation commit `4aa5227a feat: migrate POS stock counts to React` is pushed and complete on Production React Build 2026.10.04.385 / Public Build 2026.10.04.100. Preserve any remaining uncommitted/untracked work.
- Do not reset / clean / discard.
- Never merge to `main` unless the user explicitly requests it.

Laravel MASTER reference:
- `/Users/natchanonsripleng/Desktop/Sites/food-order-app-php80`
- branch `main`
- Laravel MASTER is the UI/behavior source of truth.

Local React dev server:
- `http://127.0.0.1:5002`

## Current objective

Complete React + Firebase parity without redesigning. Laravel MASTER remains authoritative for non-POS migration areas unless a newer user instruction overrides it.

Active focus as of 2026-10-04: **Modern Card v2.3 expanded-card overlap fix is prepared as React Build 2026.10.04.389 / Public Build 2026.10.04.104. User screenshots exposed that v2.2 scrolling worked but the center nav still used CSS Grid rows of about 103px while expanded cards were 119–315px tall, causing visual overlap of up to 200px. v2.3 changes only the center menu stack from Grid to natural-height Flex Column while preserving v2.1 visuals and v2.2 fixed top/bottom + internal scrolling/auto-scroll. A real Production DOM injection test with all 5 groups open showed actual heights 315/217/217/119/217px, nav scroll height 1160px, and every adjacent pair separated by a true 12px gap with zero overlap. Full operational/parity/build gates pass. Next steps: commit/push, Hosting-only deploy, then Production no-overlap verification on React and legacy POS routes.**

Retail POS migration rule (user-confirmed 2026-10-03): **for Retail POS, the current production HTML + CSS + JavaScript implementation under `public/pos` remains the UI/behavior MASTER while replacing implementation with React. Exception explicitly approved by the user on 2026-10-04: the shared POS navigation drawer is intentionally redesigned to “Modern Card v2” across both React and remaining legacy POS routes. Do not revert that shared drawer to the old scattered layout for parity. Route-specific POS screens and behavior otherwise remain 1:1 with the current production MASTER.**

Retail POS current checkpoint: **canonical Sale `/pos`, Sales history `/pos/sales`, Tax Invoice History `/pos/tax-invoices`, Returns `/pos/returns`, Staff Shifts `/pos/shifts`, Products `/pos/products`, Stock Movements `/pos/stock-movements`, and Stock Counts `/pos/stock-counts` are React. Production remains Build 2026.10.04.388 until v2.3 Build 2026.10.04.389 is deployed. The shared drawer keeps approved Modern Card v2.1 visuals and v2.2 scrolling/auto-scroll, with prepared v2.3 switching the center stack from CSS Grid to natural-height Flex Column to eliminate expanded-card overlap. Remaining not-yet-migrated routes are `/pos/purchases`, `/pos/payables`, `/pos/suppliers`, `/pos/customers`, `/pos/settings`, `/pos/backup`, and `/pos/users`.**

Customer React production-test checkpoint (2026-09-30 evening):
- Table Order React is deployed for cross-device/mobile testing on the canonical customer URL `/s/{slug}/order` without requiring `/react`.
- Final build commit before deploy: `affb7d25` (`build: finalize Order React test deploy`).
- React Version `0.4.280` / Build `2026.09.30.295`; public storefront Version `0.16.32` / Build `2026.09.30.010`.
- Generated production candidate shell references `/react/assets/index-BoWOX-Jp.js`.
- User confirmed Firebase Hosting deploy completed. Current next step is real production testing on desktop + mobile before starting Takeaway React.
- Historical note: Takeaway / Delivery / Delivery Success were outside this Order-only test cutover. Retail POS was paused at that point but resumed on 2026-10-03 as documented above.

PENGUIN branding checkpoint (2026-10-02):
- Public-facing brand is PENGUIN; compact fallback mark is PG. Visible KINJAI, LUKKAJA, Food Order Delivery, FOOD ORDER QR, standalone FOD, and KJ branding must not surface in the UI.
- Uploaded Platform App Icon is the first-choice header icon globally; Logo remains primary for login/large logo surfaces.
- Header fallback order: App Icon -> Logo -> PG. Login/large-brand order: Logo -> App Icon -> PG. Favicon order: Favicon -> App Icon -> Logo.
- Internal repo/Firebase/schema/DOM/translation identifiers are intentionally unchanged, including fod_* keys, FOD_WALLET_* error codes, Firebase project identifiers, and the existing penguin-food.web.app Hosting/auth origin.
- Current prepared release identity: React 0.4.280 / 2026.10.04.389; public storefront 0.16.32 / 2026.10.04.104. Production remains Build 2026.10.04.388 until the Modern Card v2.3 overlap-fix Hosting deploy completes.
- Primary production Hosting origin remains https://penguin-food.web.app. Legacy https://natchanon-food-order-delivery.web.app remains reachable during transition but is no longer in deploy target foodapp.
- Delivery customer auth remains privilege-isolated from staff auth: Google popup runs only in broker app penguin-google-customer-broker-v1, callable createDeliveryCustomerSession exchanges it for a namespaced cust_... custom-token session in penguin-storefront-customer-v2, and Firestore/Storage rules explicitly exclude customerContext tokens from all staff-role paths. Staff/Owner/Super Admin remain on [DEFAULT]; Delivery logout affects only customer/broker apps.
- Pull, test/build, commit generated assets, and deploy Hosting before Production visual verification.
- If uploaded Logo / App Icon artwork itself contains an old brand, replace that artwork from Platform Branding after deploy.

Documentation rule as of 2026-09-30:
- `docs/WORKLOG.md` is the chronological source for completed fixes and implementation-affecting investigations.
- **Update `docs/WORKLOG.md` after every completed change before moving to the next task.**
- Every entry must include the symptom/request, root cause when known, implementation summary, important files, verification result, commit/push/merge/deploy state, and any remaining follow-up.
- `docs/NEXT_CHAT_HANDOFF.md` remains the current continuation checkpoint; it does not replace the chronological worklog.

## Canonical production URL cutover — 2026-09-30

Production cutover is deployed on the existing URLs without `/react`:
- Customer storefront remains `/s/{slug}/order`, `/delivery`, and `/takeaway`; production checks returned HTTP 200 on all three.
- Migrated staff/admin routes use `/login`, `/cashier`, `/kitchen`, `/waiting-queue`, `/admin`, `/platform`, `/reports/...`, and related original paths.
- `/react/**` is compatibility-only and canonicalizes to the no-`/react` path, including canonical login `next` values.
- `/pos` remains legacy until the paused Retail POS checkpoint is resumed and completed.
- Current Hosting release identity: React `0.4.280` / `2026.09.30.294`; public storefront `0.16.32` / `2026.09.30.009`.
- Latest Hosting redeploy commit: `98e68180` (`chore: prepare canonical hosting redeploy`), pushed to `origin/feature/react-firebase-port`. Earlier canonical cutover commits remain `d8c5eaf4`, `2d94caa4`, `3ece7604`. No merge to `main` was performed.
- Verification: operational + React parity contracts passed, React build passed, full P0 browser smoke passed 52/52 before deploy, and the final route/auth correction gate passed 37/37.
- Firebase Hosting target `foodapp` deployed successfully at `https://natchanon-food-order-delivery.web.app`.
- Deployment scope was Hosting only. Firestore Rules, Storage Rules, and Cloud Functions were not deployed in this cutover.
- Important follow-up: the first Hosting release warned that rewrite function `lalamoveWebhook` had no valid endpoint. Do not deploy all local Functions just to clear this warning; verify/deploy that Function deliberately when the Lalamove webhook scope is resumed.
- See `docs/WORKLOG.md` for the detailed implementation and deployment record.

## Super Admin Console callable repair — 2026-09-29

Root cause found while testing `/react/platform` Slip2Go Test Connection:
- React referenced Platform callable Functions from `functions/platform-settings.js`, but `functions/index.js` did not export that module.
- Production Firebase therefore had only the older Google API pair and did not have Branding, Slip Verification, or Lalamove Platform callables.
- Added all 11 `platform-settings.js` exports to `functions/index.js` and added regression coverage in `tools/react-foundation-contract.mjs` so React Platform callable dependencies cannot silently disappear from the Functions entrypoint again.
- Deployed Functions-only (no Hosting deploy / no Build bump) for the 9 previously missing callables: Branding 2, Slip Verification 3, Lalamove 4.
- Verified production `functions:list` now contains all 11 Platform callables.
- Enhanced `testPlatformSlipVerification` to return safe diagnostic fields: status, HTTP status, Slip2Go result code, and provider message. React `PlatformPage` now shows those details in the Quota/status line on failure instead of discarding them behind the generic toast.
- Rebuilt local React bundle for Hosting Emulator; the diagnostic Function update was deployed Functions-only.
- Audited downstream Super Admin dependencies. `tenant-lalamove-wallet.js` was not exported/deployed, so all 9 tenant Lalamove Settings/Wallet callables were added to `functions/index.js` and deployed Functions-only.
- Repaired source entrypoint exports for Revenue Share, Subscription Admin, and Subscription Pricing modules so production does not depend on stale previously deployed Functions that are absent from current source exports.
- Repaired operational downstream exports for Google Delivery, Walk-in/Table operations, and Lalamove dispatch. The 6 missing production callables (`assignWalkInTable`, `moveTableSession`, and the 4 Lalamove dispatch actions) were deployed Functions-only.
- Deployed the two SaaS Setup callables that were previously local-only: `inspectLegacySaasMigration` and `migrateLegacySaasStore`.
- Added `tools/react-callable-contract.mjs` + `npm run test:react-callables`. It scans React literal callable references and fails when `functions/index.js` lacks an export.
- Final production dependency audit: React references 52 callable Functions and Firebase production contains all 52 required names (`MISSING=0`).
- Aggregate verification passed: `npm run test:react-parity`, `npm run test:operational`, and `git diff --check`.

Slip2Go test path remains `GET /api/account/info` with Bearer secret. Success is code `200001`; connection errors can now distinguish invalid credential/account/package, exhausted quota/credit, rate limiting, timeout/unavailable, and IP whitelist responses.

Slip2Go migration repair completed 2026-09-29:
- Laravel MASTER still had `https://connect.slip2go.com` in `platform_contact_settings.slip2go_api_url`, while Firebase `platformPrivateSettings/slipVerification` had the Secret/provider/receiver data but no API URL.
- Added one-time guarded backfill in `functions/platform-settings.js` for Slip2Go providers with an existing Secret and missing URL.
- Backfill writes only `slip2GoApiUrl` plus a migration marker; it does not modify the existing Secret or receiver data.
- Production log confirmed `SLIP2GO_API_URL_LEGACY_BACKFILL` executed successfully with provider `slip2go_fallback_vision` and URL `https://connect.slip2go.com`.
- `getPlatformSlipVerification` and `testPlatformSlipVerification` were redeployed Functions-only after adding the migration guard.

## Subscription Pricing callable repair — 2026-09-29

- `/react/platform/pricing` could load/calculate pricing but Save returned the generic failure toast.
- The submitted values visible during the failure (590 monthly, 12 months, amount discount 1180, VAT none/0) are valid against both Laravel MASTER and the current Firebase validation rules.
- Production `updateSubscriptionPricing` was still running the older 2026-09-19 deployment revision while the current source/entrypoint had been repaired later.
- Added safe diagnostic logging to `updateSubscriptionPricing` for validation/write failures (no secrets involved).
- Redeployed the complete pricing trio Functions-only from the current source: `getPublicSubscriptionPricing`, `getSubscriptionPricing`, and `updateSubscriptionPricing`.
- Deployment completed successfully. No Hosting deploy / Version-Build bump was performed.

## Super Admin Console status

Canonical URLs already wired to React:

- `/platform`
- `/platform/owners`
- `/platform/contact`
- `/platform/pricing`
- `/admin/tenants`

React aliases under `/react/...` remain available during migration.

Routing notes:
- `react-app/src/main.jsx` supports `/react/...` and canonical paths.
- `vite.react.config.js` copies the React entry to migrated canonical Super Admin entrypoints.

Main Console areas already present:
- Platform Branding
- Google Maps Browser API
- Google Routes API
- Google Cloud Vision API
- Slip Verification configuration
- Lalamove Central configuration
## Google API / Map status

The following Cloud Functions were missing from deployed Firebase and were deployed during this session:

- `getPlatformGoogleApis`
- `updatePlatformGoogleApis`

Firebase project: `chat-45754`
Region: `asia-southeast1`

This was a Functions-only deployment. No Firebase Hosting deployment occurred for that action.

Current map flow:
- Super Admin Console loads and saves Browser / Routes / Vision keys.
- Admin reads Browser key through `getDeliveryGoogleMapsConfig`.
- Google Maps is preferred.
- If Google auth/render fails, Admin falls back to OpenStreetMap/Leaflet.
- User later confirmed Google Maps configuration is working.

Do not remove the fallback unless explicitly requested.
## Super Admin subpages

### /platform/owners
Adjusted:
- canonical React route
- Back-to-platform button on the left
- arrow icon
- modal focus
- Escape closes modal
- password confirmation validity
- saving-state parity

### /platform/contact
Adjusted:
- public contact settings
- Google Customer Login settings UI
- Laravel-like save/load behavior

Follow-up:
- Verify customer-side Google login runtime actually consumes the Super Admin setting.

### /platform/pricing
Adjusted:
- pricing save/reset parity
- pricing is consumed by Register/Public Signup
### /admin/tenants

Added/audited:
- revenue share overview/review
- Lalamove approval/wallet actions
- backend Super Admin authorization
- subscription management for non-revenue-share tenants
- `backfillTenantSubscriptions`
- `updateTenantSubscription`
- localized report period/date display

Follow-up:
- Compare subscription card/action behavior against Laravel MASTER with real Firebase tenant data.
- Continue full tenant-card parity audit.

## SaaS Setup migration status — 2026-09-29

Laravel MASTER route:
- `/super-admin/saas-setup`

Implemented locally in React/Firebase:
- React route/page and canonical Hosting entry for `/super-admin/saas-setup`
- exact MASTER SaaS Setup translations for Thai / English / Myanmar / Lao / Khmer
- source `shops/default-shop`, target tenant, overwrite semantics, progress log, and summary behavior preserved
- legacy source reads/writes moved behind Super Admin-only callable Functions because current Firestore Rules intentionally do not expose `shops/*` to browser clients
- new callables: `inspectLegacySaasMigration` and `migrateLegacySaasStore`
- regression coverage added to `tools/react-foundation-contract.mjs`

Local verification passed:
- `npm run test:react-foundation`
- `npm run test:react-migration`
- `npm run build:react`
- `git diff --check`
- local Hosting Emulator returns the React bundle for both canonical and `/react/super-admin/saas-setup` paths

Deployment status:
- the two new callable Functions are **not deployed yet**
- Firebase Hosting is **not deployed yet**
- do not rely on the production SaaS Setup page until both callable Functions are deployed and the next Hosting release uses a new Build per the mandatory rule below.
## Shared UI parity completed

### Global FOD alignment
The generated FOD text is globally centered in shared React `.brand-mark`.

Source:
- `react-app/public/parity/css/app.css`

Regression test:
- `tools/react-foundation-contract.mjs`

### Collapse/expand chevron alignment
All cards using `AdminCollapsibleCard` center the Bootstrap chevron glyph.

Source:
- `react-app/public/parity/css/admin-workspace.css`

### Sales Report
Adjusted:
- header/back-button layout
- date localization follows selected language
- Laravel-style manual date formatting for Myanmar / Lao / Khmer

Date helper:
- `react-app/src/i18n/I18nProvider.jsx`
## Admin parity completed in this session

- Admin QR action buttons moved toward Laravel MASTER.
- Menu image positioning now uses direct vertical drag instead of the blue range slider.
- Google Map reads central Browser key and has OpenStreetMap fallback.
- Shared FOD alignment is global, not page-specific.
- Shared collapse chevron centering is global, not card-specific.

## Backend files currently important

- `functions/platform-settings.js`
- `functions/google-delivery.js`
- `functions/slip-verification.js`
- `functions/lalamove-dispatch.js`
- `functions/lalamove-webhook.js`
- `functions/tenant-lalamove-wallet.js`
- `functions/tenant-admin.js`
- `functions/saas-migration.js`
- `functions/revenue-share.js`
- `functions/subscription-pricing.js`
- `functions/subscription-pricing-core.js`

Before relying on a new callable, confirm that the named Function is actually deployed.

### Cashier loading deadlock repair — 2026-09-29

Root cause of `/react/cashier` being stuck forever on the simple loading screen:
- The page was blocked at `AuthProvider.status === "loading"`, confirmed via a temporary Cashier debug marker and Chrome headless DOM inspection.
- Port `5002` is Firebase Hosting Emulator, not the Vite dev server. Source changes under `react-app/src` are not visible there until `npm run build:react` rebuilds `public/react/`.
- `AuthProvider` now keeps Firebase `onAuthStateChanged` as the primary path but has an initial-state watchdog. If no initial callback arrives within 6 seconds it continues from `auth.currentUser`.
- User profile lookup `users/{uid}` has a 10-second timeout, so auth can no longer remain in loading forever.
- No stale cached role/profile is trusted as an authorization fallback.
- Cashier no longer blocks on the heavy `loadOperationalSnapshot()` (settings + menus + tables + orders + held bills). It opens from `watchOperationalOrders()` like MASTER/legacy behavior and has an 8-second page-data watchdog.
- Verified against the user's normal Chrome profile: `/react/cashier` rendered the real Cashier page with the current bill after the repair.
- Temporary AUTH/TENANT/STYLES/CASHIER_DATA debug marker was removed before final build.
- Cashier action-button icon spacing root cause was fixed: React order-card icons were missing Laravel MASTER's `app-icon` class, while the old spacing rule depended on `body[data-roles="cashier"]` which the Cashier page does not set. All Cashier button icons now use `app-icon`, and shared React `icons.css` gives any text button with direct `.app-icon + span` the standard 7px icon/text gap. This prevents the recurring icon-touching-label problem across React buttons without relying on page role attributes.

### Waiting Queue post-save / translation repair — 2026-09-29

React `/react/cashier/waiting-queue` fixes:
- Waiting Queue translator now prefers `waiting-queue-master-translations.json` and falls back to the older generated translation file only when needed.
- Raw keys such as `common.minute_range`, `common.remaining_minutes`, and `actions.seat` must never appear in the UI.
- The seat action now uses `seat.open` (Laravel label: เปิดโต๊ะ).
- Staff cancel-queue prompt now differentiates dismiss vs destructive confirm clearly: the left dismiss action remains `ยกเลิก` with X, while the confirm action is `ยกเลิกคิว` with a check-circle icon. React `sweetDialog` now supports explicit `confirmIcon` / `cancelIcon` overrides so labels containing “ยกเลิก” do not force both actions to the same X icon. Regression coverage is in `tools/react-foundation-contract.mjs`.
- After saving a queue, the Add Queue dialog is closed from the browser top layer first, then the Ticket dialog is opened on the next animation frame.
- Ticket `showModal()` is guarded so a dialog DOMException cannot tear down the React view.
- The Add Queue form also prevents native browser navigation at submit-capture level.
- React QR output is a data-URL `<img>`; waiting queue CSS explicitly keeps that image visible even though Laravel MASTER normally renders a QR `<canvas>`.

### React global form validation parity — 2026-09-28

React now mounts `FormValidationUi` once at the app root, porting Laravel MASTER `form-validation-ui.js` behavior across React forms:
- browser native validation bubbles are disabled with `form.noValidate = true`
- HTML constraints (`required`, `type`, `min/max`, `minLength/maxLength`, `pattern`) remain the validation engine
- errors/success are rendered with Laravel-style `data-validation-state` and `.bootstrap-invalid-feedback`
- messages come from `shared.validation.*` and follow the active locale
- `#registerForm` remains excluded because Laravel MASTER also gives registration its own validation flow
- dynamic React forms are picked up through `MutationObserver`

Waiting Queue dialogs were also corrected to use native `dialog.showModal()` / `close()` via refs instead of React `open={...}`, so Add Queue / Ticket / Seat dialogs enter the browser top layer and get the proper modal backdrop.

### Quick Order operational deployment update — 2026-09-28

Deployed to Firebase project `chat-45754` in `asia-southeast1`:
- `createWalkInOrder`
- `releaseQuickOrderHeldBill`

These are required by React `/react/cashier/quick-order` for:
- receiving payment + creating/sending a Walk-in order to the kitchen flow
- resuming/deleting held Quick Order bills

This was a Functions-only deployment. No Hosting deploy occurred, so Version/Build was not bumped.
## Mandatory Firebase Hosting Version / Build rule

**Every Firebase Hosting deployment must use a new Build.**

Minimum:
- Build changes every Hosting deploy.
- Version should bump for a user-visible release/milestone.
- Never reuse the exact same Version + Build pair.

Current React footer identity prepared for the next Hosting deployment:
- Version: `0.4.280`
- Build: `2026.09.30.294`

Current public storefront `public/assets/js/app-info.js` identity prepared for the next Hosting deployment:
- Version: `0.16.32`
- Build: `2026.09.30.009`

Before the next Hosting deploy, decide the next release identity and synchronize active release surfaces.
Review/update at minimum before Hosting deploy:
- `react-app/src/components/ParityFooter.jsx`
- `public/assets/js/app-info.js`
- current release note in `README.md`
- this handoff if it remains the active state document

Then run:

```bash
npm run test:react-foundation
npm run test:react-migration
npm run build:react
git diff --check
```

Use `npm run test:operational` when operational/POS/order logic changes.

Hosting command:

```bash
npx firebase-tools deploy --only hosting --project chat-45754
```

Do not add Hosting to a Functions deployment unless Hosting assets are intentionally being released.
## Parity verification system — 2026-09-29

A complete verification framework is now defined so the user is not expected to manually click every menu/button:
- plan: `docs/PARITY_VERIFICATION_PLAN.md`
- route/action matrix: `react-app/migration/parity-verification-matrix.json`
- matrix validator: `tools/react-parity-matrix.mjs`
- commands: `npm run test:react-parity-matrix` and aggregate `npm run test:react-parity`

Definition of Done is stricter than "page renders": route/access, visual parity, complete action inventory, navigation/dialog/toast behavior, Firebase/Function side effects, failure paths, languages, and responsive behavior must all pass before a route can be marked `verified`.

Current truth:
- the matrix covers all 53 registry routes structurally
- P0 static action inventory is generated for all 20 P0 routes and follows Laravel MASTER script-generated buttons as well as static markup
- Playwright is installed and `npm run test:react-p0-browser` currently passes 50 browser tests using the Mac's installed Google Chrome
- the browser suite covers all P0 route smoke checks, anonymous auth boundaries, public Waiting Queue failure/responsive states, Login validation/password/language interactions, and Waiting Queue Display safe controls
- `npm run test:react-p0-actions` passes source/service side-effect contracts for Cashier, Waiting Queue, Admin Tenants, and SaaS Setup
- authenticated write/destructive E2E is still pending because Firestore Emulator requires Java and this Mac currently has no Java/OpenJDK runtime
- never substitute uncontrolled production writes for the missing isolated Firestore Emulator coverage
- canonical P0 audit currently shows a mixture of React and legacy entries; the matrix validator now forbids marking a route `verified` unless its canonical entry is React

Do not claim that every button has been tested until P0/P1/P2 action inventories and browser/data coverage are completed per the plan.

## Revenue-share suspension access flow — 2026-09-29

Laravel MASTER behavior was audited and React/Firebase was corrected to match it:
- Laravel `AuthorizeLegacyWebPage` redirects any non-super-admin tenant user with `revenueShareSuspended=true` away from protected tenant pages to `/reports/revenue-share`.
- Laravel API middleware blocks non-revenue-share APIs with HTTP 423 `TENANT_REVENUE_SHARE_SUSPENDED`, while revenue-share APIs remain available so the store can submit payment evidence.
- Laravel `TenantAccess::allows()` intentionally keeps Owner/Admin sessions valid during revenue-share suspension; other tenant roles remain blocked.
- React previously treated every revenue-share suspension as `TENANT_INACTIVE` in both login and `TenantProvider`, causing the indefinite loading/redirect problem. Owner/Admin now retain tenant context while suspended; cashier/kitchen/other roles remain blocked.
- Added React `RevenueShareSuspensionGuard`: protected tenant routes redirect suspended Owner/Admin to `/reports/revenue-share` before those pages mount/load deeper data. Public Waiting Queue customer/display routes are excluded.
- Added suspension detail fields to Firebase `getTenantRevenueShareAccess` and Laravel `/api/tenant/revenue-share/access`: reason, suspended time, period type/start/end. Firebase callable was redeployed Functions-only.
- Added a clear suspension warning banner to Laravel MASTER and React Revenue Share pages. It distinguishes `missing_payment`, `rejected_payment`, and generic suspension and explains that the store is restored automatically after payment approval.
- Added suspension translations for Thai, English, Myanmar, Lao, and Khmer.
- Found and fixed a second loading cause: React requested `revenue-share-report.css` but the file was absent from parity assets. The CSS is now copied from Laravel MASTER and included permanently in `tools/sync-react-parity-assets.py`.
- Translation parity sync was hardened to include every PHP language file across the five supported locales (53 groups currently), preventing generated parity translations from silently dropping groups such as `cashier_documents`.
- Storage rules were verified: Owner/Admin can still create/read revenue-share slip files while the tenant is revenue-share suspended; tenant active status is not required for that path.
- Verification passed: Laravel PHP/JS syntax, `npm run test:react-foundation`, `npm run test:react-callables`, `npm run build:react`, and `git diff --check` for both repositories.

## Subscription expiry / suspension login enforcement — 2026-09-29

Laravel MASTER and React/Firebase now distinguish subscription expiry from other tenant suspension states instead of collapsing everything into `TENANT_INACTIVE`.

- Laravel `TenantAccess::subscriptionStatus()` already computes effective status on every request from `subscriptionExpiresAt + gracePeriodDays`; React previously checked only stored `subscriptionStatus` / `active`, which allowed an expired-but-not-yet-synced tenant to keep using the dashboard.
- Added React `react-app/src/auth/tenantAccess.js` with the same effective-status semantics: active, grace, expired, suspended, revenue-share active/suspended.
- `authFlow.js` now blocks new login with specific `TENANT_SUBSCRIPTION_EXPIRED` or `TENANT_SUSPENDED` errors.
- `TenantProvider` now uses a Firestore `onSnapshot` listener plus a 30-second time-based access recheck. This handles both Super Admin status changes and subscriptions crossing the expiry/grace boundary without requiring a page reload or waiting for the scheduled sync job.
- Existing signed-in expired/suspended tenants are signed out and hard-redirected to `/react/login?reason=subscription_expired` or `/react/login?reason=tenant_suspended`. A previous React Router/signOut race that could land on public `/react` instead of Login was fixed by sequencing sign-out then `window.location.replace()`.
- Login page shows the specific reason immediately before any new credential submission. Added Thai, English, Myanmar, Lao, and Khmer strings for expired package and suspended store.
- Laravel MASTER now returns specific API errors `TENANT_SUBSCRIPTION_EXPIRED` / `TENANT_SUSPENDED`, web middleware redirects expired/suspended sessions to Login with the matching `reason`, and the legacy login UI maps those codes/reasons to the same messages.
- Revenue-share suspension remains a separate exception: Owner/Admin retain tenant context and are redirected to `/reports/revenue-share`; other roles remain blocked.
- Added `npm run test:tenant-access` behavioral contract covering active, grace, expired, suspended, inactive, and revenue-share suspension cases. P0 browser coverage also verifies the expired redirect message on Login.
- Verification passed: React tenant-access contract, foundation contract, callable contract, React build, Playwright expired-login UI test, Laravel `LegacyAuthContractTest`, Laravel `WebPageAuthorizationContractTest`, and `git diff --check`.

## Mandatory UI layer policy — 2026-09-29

A global stacking policy is now mandatory across Laravel MASTER and React/Firebase. Full policy: `docs/UI_LAYER_POLICY.md`.

Required order, highest to lowest:
1. **Toast Alert** — must always remain visible and must never be covered.
2. **SweetAlert / shared confirmation dialog**.
3. **Modal / native `<dialog>` / drawer-style modal**.
4. Normal page UI and loading overlays.

Implementation details:
- Canonical layer tokens are in Laravel MASTER `public/assets/css/ui-layer-stack.css`; React receives the parity copy through `tools/sync-react-parity-assets.py`.
- `toast-top-layer.js` is now a full Top Layer manager, not just a z-index helper. Native `showModal()` participates in the browser Top Layer and can beat any normal z-index. Chromium can also keep a native modal above a body-level popover, so the manager mounts overlays inside the topmost native modal host when one exists, then promotes active Sweet Dialog first and visible Toast last.
- Global order is therefore enforced as **Toast > Sweet Dialog > Modal**, including when a native modal opens after an existing Toast/Sweet Dialog.
- Do not solve new page issues by inventing a larger hard-coded z-index. New Toast/Dialog/Modal components must use the shared selectors/data-layer hooks and central tokens.
- Added `npm run test:ui-layers` plus a Playwright browser test that opens a native modal, Sweet Dialog, and Toast together and verifies actual visual/top-layer order.

## Revenue-share save failure / Cloud Function mismatch — 2026-09-29

The `/react/admin/tenants` revenue-share modal showed `บันทึกส่วนแบ่งไม่สำเร็จ` even though the submitted rate/cycle were valid.

Root cause:
- Local React and Laravel MASTER intentionally do **not** ask for or submit `recipientName` in this modal.
- The deployed `updateTenantRevenueShare` Cloud Function was stale. Its deployed source still rejected enabled revenue-share settings unless `recipientName.length >= 2`.
- Cloud log at approximately 09:05 ICT confirmed the callable request reached `updateTenantRevenueShare` with valid Firebase Auth.
- The stale deployed function hash was `fc70e695d7b8aacd0d582d380ac9baf21851a9fe`.

Resolution:
- Kept React aligned 1:1 with Laravel MASTER; did not add a legacy recipient-name field.
- Deployed **only** `functions:updateTenantRevenueShare` from the current local source. Firebase Hosting was not deployed and Version/Build were not changed.
- New deployed function hash: `25cfe5941b9061c2d97d94986a9adc197ae4ef5b`, state ACTIVE.
- Function syntax, React foundation contract, UI layer contract, React build, and `git diff --check` passed after the fix.
- No commit / push / merge performed.

## Admin Tenants initial loading flow — 2026-09-29

The `/react/admin/tenants` page previously showed two consecutive loading states: the full-page PageReadyOverlay first, then the page rendered while the tenant list still showed `กำลังโหลดรายการร้านค้า...`.

Root cause:
- The full-page loader waited only for Auth + parity styles, not the initial tenant list.
- Worse, React serialized the critical `listTenants()` call behind `backfillTenantSubscriptions()`, so the tenant list did not even start loading until maintenance/backfill work finished.
- Laravel MASTER does not do this; its initial flow starts tenant list and sales loading immediately/in parallel.

Resolution:
- Added `initialTenantsReady` as a critical page-readiness condition for Super Admin.
- `listTenants()` now starts immediately as soon as the Super Admin profile is ready.
- The full-page loader remains visible until the first tenant list request completes, so the initial page reveal should already contain the tenant list (or a load error) instead of a second tenant-list loading phase.
- Subscription backfill now runs in the background and no longer blocks initial rendering.
- If backfill actually updates tenant records, the tenant list is refreshed silently without showing the section loading placeholder again.
- Added regression assertions to the React foundation contract to preserve this ordering.
- Verification passed: React foundation contract, React build, and `git diff --check` in both repositories.

## Home dashboard icon palette stability — 2026-09-29

The staff home icon palette regressed to green after parity sync because `home-dashboard.css` bound card identity to Laravel-only href selectors such as `/kitchen`, `/cashier`, `/admin`, and `/waiting-queue/`, while React routes use `/react/...`.

Resolution:
- Dashboard visual identity is now route-independent and uses semantic `data-dashboard-card` keys in both Laravel MASTER and React.
- Keys currently include `kitchen`, `cashier`, `waiting_queue`, `admin`, `admin_users`, `revenue_share`, `pos`, and `pos_catalog`.
- Canonical color selectors live in Laravel MASTER `public/assets/css/home-dashboard.css` and are synced to React.
- Required palettes: Kitchen orange, Cashier blue, Waiting Queue green, Admin teal, Staff Admin purple. POS/revenue-share keep their defined green/teal palettes.
- React foundation contract now asserts semantic keys/selectors and explicitly rejects returning to `.nav-card[href="/kitchen"]` route-coupled styling.
- Browser computed-style verification confirmed all five primary icon foreground/background colors are distinct and correct.
- React foundation test, React build, and `git diff --check` passed in both repositories.

## Button icon spacing + User Menu palette stability — 2026-09-29

Two UI regressions were fixed after parity sync:
- Quick Order held-bill action buttons (`เปิดบิลต่อ`, `ลบ`) had icons touching their labels because the shared spacing selector only matched `.app-icon + span`, while these buttons use a plain Bootstrap `<i>` followed by `<span>`.
- React User Profile menu icon colors regressed to the default green because `icons.css` still keyed palettes from Laravel-only hrefs such as `/cashier/table-qr`, `/admin`, and `/admin/users`, while React uses `/react/...` routes.

Resolution:
- Shared button spacing now covers direct `.app-icon + span`, `i + span`, and `svg + span` patterns with a 7px gap. Quick Order held-bill actions also carry an explicit local 7px gap safeguard.
- User Menu visual identity is route-independent and uses `data-user-menu-key` in both Laravel MASTER (`local-auth-service.js`) and React (`UserMenu.jsx`).
- Semantic keys include `home`, `platform`, `tenants`, `waiting_queue`, `table_qr`, `admin`, and `admin_users`; password and logout continue using semantic action/state selectors.
- Canonical user-menu palettes remain: Home/Platform green, Waiting Queue green, Open Table blue, Store Admin cyan/teal, Staff Admin purple, Change Password amber, Logout red.
- React foundation contract now rejects Laravel-only href color selectors and verifies semantic menu keys plus generic icon/text button spacing.
- Chrome computed-style verification confirmed held-bill button gap = 7px and distinct User Menu foreground/background colors.
- React foundation test, React build, Laravel JS syntax, and `git diff --check` passed.

## Owner password dialog shared styling — 2026-09-29

React UserMenu password-change dialog rendered as an unstyled raw form because the dialog CSS only existed inside Laravel `local-auth-service.js` via runtime `ensurePasswordStyles()` injection; React reused the markup but had no equivalent injected style.

Resolution:
- Moved canonical Owner Password Dialog styling into Laravel MASTER `public/assets/css/icons.css`, which is synced to React parity assets.
- Removed the duplicated runtime CSS injection from Laravel `local-auth-service.js`; the function now relies on shared CSS.
- Added `data-ui-layer="modal"` to both Laravel and React password-dialog backdrops and registered `.owner-password-backdrop` in `ui-layer-stack.css`.
- Layer order remains: Toast `2147483647` > Sweet Dialog `2147483600` > Password/other Modal `2147483000`.
- Chrome computed-style verification: backdrop fixed/full viewport, centered grid, modal z-index `2147483000`, dialog ~497px desktop width with 26px radius.
- Hosting Emulator serves the new password-dialog CSS from `/react/parity/css/icons.css`.
- UI layer contract, React foundation contract, React build, Laravel JS syntax, and `git diff --check` all passed.

## Owner password dialog viewport centering — 2026-09-29

After the shared password-dialog CSS was restored, React still rendered the modal clipped toward the top instead of centered in the viewport.

Root cause:
- React rendered `OwnerPasswordDialog` as a descendant of `UserMenu` inside `.app-header`.
- `.app-header` uses `backdrop-filter: blur(10px)`, which creates a containing block for fixed descendants in Chromium/WebKit.
- Therefore `.owner-password-backdrop { position: fixed; inset: 0; place-items: center; }` was centered relative to the header containing block instead of the browser viewport.
- Laravel MASTER did not have this problem because `local-auth-service.js` appends the password backdrop directly to `document.body`.

Resolution:
- React `OwnerPasswordDialog` now uses `createPortal(..., document.body)` from `react-dom`, matching Laravel MASTER behavior.
- The modal remains tagged `data-ui-layer="modal"`, so global stacking remains Toast > Sweet Dialog > Modal.
- Added React foundation regression assertions requiring the password dialog to portal to `document.body`; do not replace this with top/margin offsets.
- Verification passed: React foundation contract, UI layer contract, React build, and `git diff --check` in both repositories.

## Cashier Table QR desktop 4-column layout — 2026-09-29

The `/react/cashier/table-qr` desktop page was too narrow because it inherited the shared `.container` max-width of 1120px and `.grid-3` three-column layout.

Resolution:
- Added a page-scoped Desktop rule in Laravel MASTER `order-delivery-workspace-theme.css` for `body.od-qr-page` only.
- At viewport widths >= 1200px, the Table QR container expands to `min(1440px, calc(100% - 48px))`.
- `#availableTables`, `#occupiedTables`, and `#walkInTables` render 4 equal columns on Desktop.
- Tablet/Mobile continue to use the existing shared responsive grid behavior; other `.grid-3` pages are unaffected.
- Synced the canonical CSS to React parity assets.
- Chrome computed-style verification at 1600px viewport: container 1440px and 4 columns of ~342.5px each.
- React foundation contract now locks the page-scoped 1440px/4-column rule.
- React foundation test, React build, and `git diff --check` passed in both repositories.

## Admin Users initial loading + header placement — 2026-09-29

Two regressions on `/react/admin/users` were fixed:
- Initial render showed two loading phases because the full-page PageReadyOverlay did not wait for `listStaffUsers()`; after the overlay disappeared the staff table still showed `กำลังโหลด...`.
- The back button had been incorrectly moved into the right action group. Required layout is left: brand + back button; right: locale + User Profile.

Resolution:
- Added `initialUsersReady`; the full-page loader now remains until the first staff-list request completes (success or handled error), so the initial page reveal no longer exposes a second table-loading phase.
- Header now uses `.admin-users-header-leading` for `brand + ← กลับหน้าจัดการร้าน` on the left.
- `.admin-users-header-actions` contains only LocaleSwitcher + UserMenu on the right, with the standard 8px gap.
- Laravel MASTER uses the same leading/actions structure; local-auth service moves locale/UserMenu into the existing right action container.
- Added React foundation regression assertions for initial staff readiness and left/right header structure.
- Chrome layout verification at 1600px: leading starts at x=16, back button x≈185; right actions x=1360..1584, locale immediately before User Menu.
- React foundation test, React build, and `git diff --check` passed in both repositories.

## Admin menu sorting mobile touch parity — 2026-09-29

On `/react/admin`, category/menu ordering showed drag handles on Mobile but could not actually be dragged by touch.

Root cause:
- React used native HTML5 `draggable` + `dragstart/drop`, which works with desktop mouse drag but is not reliable/available for touch dragging on mobile browsers.
- Laravel MASTER already uses SortableJS 1.15.6 with explicit coarse-pointer/touch fallback options.

Resolution:
- React Admin now imports and uses `sortablejs` for both `#categorySortList` and `#itemSortList`, matching Laravel MASTER behavior.
- Dragging is handle-only via `.sort-handle` and preserves the MASTER touch options: 180ms touch delay, `delayOnTouchOnly`, coarse-pointer threshold 8, `forceFallback`, `fallbackOnBody`, and fallback tolerance 5.
- Removed the old category/menu HTML5-only `draggable/onDragStart/onDrop` implementation.
- Added stable `data-sort-category` / `data-sort-menu-id` keys and React refs; Sortable `onEnd` updates React order state.
- Added React foundation regression assertions preventing fallback to HTML5-only drag/drop.
- Real Chrome touch emulation at 440x956 passed: touch-drag changed order from `A,B,C` to `B,C,A` and fired Sortable `onEnd`.
- React build, React foundation contract, and `git diff --check` passed.

## Admin category drag smoothness parity — 2026-09-29

After enabling SortableJS touch dragging on `/react/admin`, category dragging still felt less smooth than menu/product dragging.

Root cause:
- React rendered each category sort row itself as a `<button>` with `onClick` while also using that same row as the Sortable draggable item.
- On touch devices the category row therefore participated in both tap/click selection and drag gesture handling, unlike menu/product rows.
- Laravel MASTER already avoids this conflict: the draggable category row is a `<div class="sort-item">`, the handle owns drag, and a separate inner button owns category selection.

Resolution:
- React category rows now match Laravel MASTER structure: draggable outer `div.sort-item`, separate `.sort-handle`, and a nested transparent selection button.
- Selected category styling now uses the MASTER `active-category` class.
- SortableJS remains handle-only, so dragging the handle no longer triggers category selection/click behavior.
- React foundation contract now prevents category sorting from regressing to a clickable draggable-row implementation.
- Real Chrome touch emulation at 440x956 passed: drag reordered `A,B,C` to `B,C,A`, `onEnd` fired, and no category click was emitted during the drag (`selected` remained null).
- React foundation contract, React build, and `git diff --check` passed in both repositories.

## Admin category drag visual latency — 2026-09-29

User clarified the category-sort issue was visual latency: the dragged graphic followed the finger more slowly than the product/food sorter.

Root cause / comparison:
- The product/food sorter uses a lower-latency Sortable profile: animation 120ms, touch delay 80ms, threshold 4px, scroll sensitivity 60/speed 14.
- Admin category sorting had been using animation 180ms, touch delay 180ms, threshold 8px and forced fallback on touch, which made the dragged visual feel delayed.
- Admin parity CSS also lacked the product sorter's `.sort-fallback` visual treatment, and the combined `admin-retail-pos-parity.css` still carried the older drag styling.

Resolution:
- Laravel MASTER `admin-sort.js` and React Admin now use animation 120ms, touch delay 80ms, threshold 4px, handle-only drag, scroll sensitivity 60/speed 14.
- Mobile still uses fallback drag for reliability, but the fallback clone now has `transition:none`, `will-change:transform`, stronger drag shadow/background and explicit z-index.
- Updated both canonical `admin-sort.css` and the later-loaded `admin-retail-pos-parity.css` duplicate so the old drag style cannot override the low-latency visual.
- React foundation contract now locks the low-latency Sortable profile.
- Real Chrome touch emulation verified the fallback clone tracks the touch position with approximately 0px delta after activation, and reordered `A,B,C` to `B,C,A` successfully.
- React foundation contract, React build, Laravel admin-sort JS syntax, and `git diff --check` passed.

## Retail POS pause checkpoint — 2026-09-30

Decision:
- **Pause Retail POS work here.**
- Active development now returns to **Order / Delivery / Takeaway** and those three flows should be completed before returning to POS.
- Do not throw away or restart the POS migration when work resumes; continue from this checkpoint and the current uncommitted source.

Repository safety at this checkpoint:
- Active branch remains `feature/react-firebase-port`.
- HEAD remains `013fd5ad feat: centralize subscription pricing and header layout`.
- POS work described below is still part of the large uncommitted/untracked React migration.
- No commit / push / merge / Hosting deploy was requested for this POS checkpoint.
- Do not reset / clean / discard any of this work.

### POS sale / receipt / printing checkpoint

Completed or materially implemented:
- `/react/pos` remains the React/Firebase retail sale screen using Laravel MASTER as the 1:1 UI/behavior reference.
- Receipt popup is implemented at `/react/pos/receipt`.
- Receipt page uses the Laravel MASTER receipt CSS through parity assets.
- Manual and Auto Print flows wait for fonts/content before calling `window.print()`.
- Paper selection supports the current 58mm / 80mm / A4 flow.
- A React-specific print bug was found and fixed: Laravel MASTER print CSS hides `body > :not(.page)`, while React wraps the page in `#root`; React now explicitly preserves `#root` during print.
- Native Chrome Print Preview was verified after that repair and the receipt is visible instead of printing a blank page.
- Full-tax-invoice action/dialog is present in the Receipt flow, including the DBD/tax-buyer lookup path.
- Firestore tax-invoice support and running-number work was added locally.
- A4 tax-invoice print route exists at `/react/pos/tax-invoice`.
- Tax Invoice A4 pagination is set to 20 items per page.
- Receipt and tax-invoice CSS remain tied to Laravel MASTER parity sync.
- The legacy post-payment `paymentCompleteDialog` was removed from React after checking current Laravel MASTER runtime: current MASTER closes the payment dialog, resets the sale, shows success feedback, and only opens Receipt automatically when Auto Print is enabled. The old `retail-pos-complete.js` file exists in MASTER but is not part of the current `/pos` runtime.
- Receipt print safe padding was discussed but intentionally **not changed** because Laravel MASTER currently prints with zero page margin/padding; preserve parity until a coordinated MASTER + React change is requested.

### POS navigation checkpoint

`PosNavigation` was updated locally so the main POS menu no longer intentionally sends migrated items back to legacy pages.

React routes now exist for the sales-side group:
- `/react/pos`
- `/react/pos/sales`
- `/react/pos/tax-invoices`
- `/react/pos/returns`
- `/react/pos/shifts`

React routes now also exist locally for:
- `/react/pos/products`
- `/react/pos/stock-movements`
- `/react/pos/stock-counts`
- `/react/pos/purchases`
- `/react/pos/payables`
- `/react/pos/suppliers`
- `/react/pos/customers`
- `/react/pos/settings`
- `/react/pos/backup`
- `/react/pos/users`

Navigation label behavior was also repaired:
- React previously displayed raw translation keys such as `pos_users.permission_items.pos_sales`.
- Laravel MASTER has label fallback behavior.
- React now has a fallback label path so missing permission translations display the intended Thai label instead of the raw key.

### POS supporting-page local implementation status

The following work exists locally and must be preserved, but should be treated as **migration work pending final 1:1 review**, not as production-complete simply because the route renders:

Sales / tax / return / shift:
- Sales history reads Firebase sales data and includes the Receipt reprint path.
- Tax-invoice listing reads `taxInvoices` and opens the A4 print route.
- Return flow has local Firestore transaction work for return/VOID, stock restoration, stock movements, and RF/VD running numbers.
- Shift flow has local open/close shift data work and SH running numbers.

Stock:
- Stock movement page reads the existing `stockMovements` data.
- Stock-count flow was added locally using the same product stock transaction model rather than a separate stock implementation.
- Stock Count writes `stockCounts`, adjusts product stock, and creates movement type `count`.

Purchasing:
- Local Firebase purchasing data layer was added for `suppliers` and `purchases`.
- Receive-stock work updates stock, average cost, and stock movement in one transaction.
- Payables use purchase balance/payment history.
- Supplier CRUD is present locally.

Customer / settings / system:
- Customer CRUD was added on the same `customers` collection used by POS/customer loyalty.
- POS Settings reads/writes tenant `settings/store`, `tax`, `payment`, `receipt`, and `loyalty`.
- POS Settings reuses the existing React `AdminMap` component so Google Maps Browser key → Leaflet fallback behavior does not split into another map implementation.
- POS role settings are stored in `settings/pos-roles` and `PosNavigation` now loads the shared Firebase role settings rather than depending only on localStorage.
- Local staff-role source was extended to support `manager` and `stock` roles in addition to the existing POS staff roles.
- Local callable source `functions/retail-pos-backup.js` was added for tenant-scoped owner-only POS backup/restore.

### Critical deployment state when POS is resumed

**Do not assume the new POS write paths are deployed.**

At the pause point:
- Firestore Rules changes for the newer POS collections/operations are local source changes and have not been deliberately deployed as part of this POS work.
- New/changed callable Functions for POS Backup/Restore and expanded staff roles are local source changes and have not been deliberately deployed as part of this POS work.
- No Firebase Hosting deploy was performed for this POS checkpoint.
- Therefore no Hosting Version/Build bump was performed for this checkpoint.
- Local testing was being done through the Firebase **Hosting emulator only**. This is important: Hosting emulator rendering does not prove undeployed production Firestore Rules or Cloud Functions write paths.
- Read/render checks can pass while a production write still fails until the matching Rules/Functions are deployed.

When deployment is eventually requested:
1. Review exactly which Rules/Functions changed and deploy only the required backend pieces first when appropriate.
2. Test real write paths for Return/VOID, Shift open/close, Stock Count, Purchasing/Payables/Suppliers, Customers/Settings, role permissions, and Backup/Restore.
3. For any Hosting deploy, obey the mandatory rule: change Build first, review Version, run tests/build, and never reuse the same Version+Build pair.

### POS runtime verification state

Last broad checks before pausing:
- `npm run test:react-foundation` passed after the POS additions.
- `npm run test:operational` passed.
- `npm run build:react` passed; the build included 131 modules in the last full run.
- `git diff --check` passed.
- The React POS supporting routes were opened in real Chrome from the local Hosting emulator.
- The first batch of screenshots made some newer pages look blank because captures were taken before asynchronous Firebase data finished loading.
- `/react/pos/settings` was rechecked with a longer wait and rendered correctly with real store/tax data.

Known POS follow-up before calling the module complete:
- Replace blank initial waits on the newer supporting pages with the standard full-page readiness/loading treatment instead of returning visually empty while Firebase is loading.
- Re-run visual parity comparison page-by-page against Laravel MASTER; the newer supporting pages are not yet declared visually final.
- Re-run PC / Tablet / Mobile checks.
- Verify permissions for owner/admin/manager/cashier/stock/kitchen roles.
- Verify all write flows after the required backend Rules/Functions are deployed.
- Re-test sales-history → reprint, tax-invoice issue/print, return/VOID stock effects, shift totals, stock count, purchasing/average cost/payables, customer/loyalty, settings/map, backup/restore, and users/roles end-to-end.
- Keep the existing Receipt/Print fixes intact while doing that work.

## Recommended next development order

The active priority was intentionally changed on 2026-09-30:

1. Return to the customer-facing **Order** flow and finish `/order` React/Firebase parity against Laravel MASTER.
2. Finish **Delivery** end-to-end, including shared catalog/cart/customer/address/payment/map/delivery dependencies that the Laravel MASTER flow requires.
3. Finish **Takeaway** end-to-end with the same 1:1 parity rule.
4. Reconcile the shared Order / Delivery / Takeaway components so common fixes are not duplicated or allowed to drift between the three channels.
5. Verify the three flows on Desktop / Tablet / Mobile and test the real button/action path from selecting products through order submission and post-submit state.
6. Run React foundation/operational/parity checks and `git diff --check` before considering those three flows complete.
7. Only after Order / Delivery / Takeaway are complete, return to **Retail POS** and resume from the POS pause checkpoint above.
8. Do not commit / push / merge / deploy until explicitly requested.

## New-chat instruction template

Use Desktop Commander and continue at:
`/Users/natchanonsripleng/Desktop/Sites/food-order-app`

Read `README.md` → `STRUCTURE.md` → `docs/NEXT_CHAT_HANDOFF.md` → `docs/WORKLOG.md` → `docs/SAAS_MIGRATION.md`, then inspect Git branch/HEAD/status.
Preserve all uncommitted work. Do not commit/push/merge until explicitly requested.
Update `docs/WORKLOG.md` after every completed change before starting the next task.
Use Laravel MASTER at `/Users/natchanonsripleng/Desktop/Sites/food-order-app-php80` branch `main` as the 1:1 UI/behavior reference.
Current active focus after the 2026-09-30 POS checkpoint is to finish Order / Delivery / Takeaway first; resume POS only afterward from the documented checkpoint.
Before every Firebase Hosting deploy, change Build, review Version, build/test, and never deploy the same Version+Build pair twice.

### React blank-page / stale entry bundle repair — 2026-09-29

Root cause confirmed with Chrome DevTools Protocol on /react/cashier/waiting-queue:
- The blank page was not a WaitingQueuePage render crash.
- Chrome failed the React entry module because a previously-open tab referenced an old hashed /react/assets/index-*.js that had been removed by Vite emptyOutDir: true.
- Firebase Hosting rewrite for the missing JS returned /react/index.html as text/html, causing Chrome's strict module MIME error and leaving only the blank/fallback page.
- Vite now uses emptyOutDir: false so previous hashed entry bundles survive subsequent local builds.
- Firebase Hosting now sends Cache-Control: no-cache, no-store, must-revalidate for /react and /react/**.
- react-app/index.html has a one-time entry-module recovery reload for stale/missing /react/assets/* module scripts; main.jsx clears the recovery marker after the entry module executes.
- Auth bootstrap now uses Firebase auth.authStateReady() and no longer treats a temporary currentUser === null timeout as a real logout; unresolved auth becomes an error after 15 seconds instead of redirecting incorrectly.
- Final verification after cleanup: current Waiting Queue build rendered .waiting-page with the real queue/table data, title จัดการคิวรอโต๊ะ, and no React exception/MIME entry failure.
- Temporary WaitingQueueDebugBoundary was removed before final build.

### Waiting Queue post-save white-screen root cause — 2026-09-29

Exact post-save crash confirmed:
- After createWaitingQueue() succeeded, submitAdd() called setTicket(row).
- The ticket QR effect then called qrDataUrl(url, 220).then(setTicketQr).
- react-app/src/utils/localQr.js qrDataUrl() is synchronous and returns a data:image/svg+xml string, not a Promise.
- Calling .then() on that string threw during the React effect immediately after the add dialog closed, producing the user-observed white screen.
- Fixed WaitingQueuePage to call setTicketQr(qrDataUrl(url, { size: 220, margin: 4 })) inside try/catch.
- Repository search confirmed this was the only incorrect Promise-style qrDataUrl usage; Cashier, Quick Order, Receipt, Admin QR, and Table QR already use the synchronous API correctly.
- Added a react-foundation regression assertion forbidding qrDataUrl(url, 220).then in WaitingQueuePage.
- Full post-save flow verified in an isolated offline Chrome profile so no Firebase test queue was created: add dialog opened, save completed locally, add dialog closed, ticket dialog opened, queue W004 was shown in the test profile, QR src began with data:image/svg+xml, and .waiting-page remained mounted with no runtime exception.
