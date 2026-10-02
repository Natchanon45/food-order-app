# Development Worklog

Updated: 2026-09-30

This file is the chronological engineering worklog for the React + Firebase migration.

## Mandatory logging rule

After **every completed repair, behavior change, investigation that changes implementation, or intentional pause**, update this file **before starting the next task**.

Every entry must record:
- Date and scope.
- Symptom / request.
- Root cause when known.
- What changed.
- Important files touched.
- Verification performed and result.
- Deployment state: whether commit / push / merge / Firebase deploy happened.
- Remaining follow-up or known limitation.

Do not treat a chat reply as the only record of a change. If code changed, the corresponding worklog entry must be updated in the same work session.

Use `docs/NEXT_CHAT_HANDOFF.md` for the current continuation checkpoint and priorities. Use this file for chronological change history.

---

## 2026-09-30 — Documentation discipline

Request:
- Keep a persistent record of every completed code change so previous fixes can always be reviewed later.

Change:
- Created `docs/WORKLOG.md`.
- Added a mandatory post-change logging rule.
- README and NEXT_CHAT_HANDOFF reference this worklog and require it to be updated before moving to another task.

Verification:
- Documentation-only change; `git diff --check` must remain clean after the documentation update.

Deploy state:
- No commit / push / merge / deploy requested.

---

## 2026-09-30 — Retail POS pause checkpoint

Scope:
- `/react/pos` and supporting Retail POS routes.

Result:
- POS work was intentionally paused so Order / Delivery / Takeaway could be completed first.
- The detailed POS state, implemented routes, undeployed Rules/Functions, tests, and known follow-up were recorded in `docs/NEXT_CHAT_HANDOFF.md`.

Important rule:
- Do not restart the POS migration from scratch. Resume from the recorded POS checkpoint after customer ordering flows are complete.

Deploy state:
- No commit / push / merge / Hosting deploy for the POS checkpoint.

---

## 2026-09-30 — Delivery Success parity: icons + 5-language public i18n

Symptom:
- Delivery Success did not match Laravel MASTER for action icons and language behavior.
- Static Firebase storefront supported only Thai / English while Laravel MASTER supported Thai / English / Myanmar / Lao / Khmer.

Root cause:
- Delivery Success is a static storefront page rather than a React Router page.
- Static public i18n had only two supported locales and old cached module versions.
- The success page depended on shared layout behavior that Laravel receives automatically from `layouts.app`.

Change:
- Synced public translation dictionaries for `order / takeaway / delivery / verify / shared` from Laravel MASTER for 5 locales.
- Extended public `i18n.js` locale support to `th / en / my / lo / km`.
- Updated the static locale switcher to render all five languages.
- Added explicit icons to Delivery Success actions such as Order Again, Download Order, Verify Latest, and Driver Tracking.
- Preserved button icons while dynamic button labels change.
- Added the Delivery tracking card/CSS used by Laravel MASTER.
- Updated the public footer to use localized shared strings.

Important files:
- `public/delivery/success/index.html`
- `public/assets/js/delivery-success.js`
- `public/assets/js/public-page-static-i18n.js`
- `public/assets/js/public-translations.js`
- `public/assets/js/i18n.js`
- `public/assets/js/ui.js`
- `public/assets/css/delivery-success-tracking.css`

Verification:
- Thai and English runtime verified in Chrome.
- Source-level translation lookup verified all 5 locales.
- `git diff --check` passed.

Deploy state:
- Not committed / pushed / merged / deployed.

---

## 2026-09-30 — Storefront /react route rewrite repair

Symptom:
- URL `/s/{slug}/react/takeaway/` displayed the Delivery page.
- The same route family also affected `/react/order`.

Root cause:
- Firebase Hosting had rules for `/s/*/order`, `delivery`, and `takeaway`, but not the `/s/*/react/...` variants.
- These URLs fell through to `/s/** -> /delivery/index.html`.

Change:
- Added explicit Hosting rewrites before the fallback for `/s/*/react/order`, `/s/*/react/delivery`, `/s/*/react/delivery/success`, `/s/*/react/takeaway`, and nested paths.
- Restarted only the local Firebase Hosting emulator so it would reload `firebase.json`.

Verification:
- Local emulator responses verified Order -> Order, Delivery -> Delivery, Takeaway -> Takeaway, and Delivery Success -> Delivery Success.
- `firebase.json` parsed successfully.
- `git diff --check` passed.

Deploy state:
- Local emulator restart only. No production deploy.

---

## 2026-09-30 — Delivery 5-language switcher module-version repair

Symptom:
- Delivery dropdown still showed only Thai / English after shared locale support was expanded.

Root cause:
- Delivery loaded multiple i18n module instances with different query-string versions.
- Supporting modules such as `delivery-addresses.js` mounted the old 2-language switcher first.

Change:
- Unified Delivery entry/supporting modules on the same 2026-09-30 i18n module version.
- Updated Delivery address, location, status-sync, payment-lock, UI, and i18n bootstrap dependencies to avoid mixed cached module instances.

Verification:
- Headless Chrome DOM showed 5 `.app-locale-option` entries.
- Labels present: ไทย / English / မြန်မာ / ລາວ / ខ្មែរ.
- Syntax checks and `git diff --check` passed.

Deploy state:
- Local only; no production deploy.

---

## 2026-09-30 — Takeaway 1:1 visual parity restoration

Symptom:
- Takeaway route was correct after rewrite repair, but UI did not match Laravel MASTER.

Root cause:
- Static Takeaway had an older HTML structure and did not load current Laravel MASTER `pos-refresh.css`.
- Several shared CSS files had drifted from MASTER.

Change:
- Rebuilt `public/takeaway/index.html` structure from current Laravel MASTER while preserving Firebase data/service behavior.
- Restored hero store-name + bag icon, Desktop 2-column menu layout, right-side cart, MASTER add-button/card behavior, and sticky bottom summary.
- Synced relevant shared CSS from Laravel MASTER.
- Kept 5-language public i18n support and real store-name rendering.

Verification:
- Runtime checked in Chrome.
- Hero, 2-column menu, right cart, and sticky bottom bar visibly restored.
- CSS hashes checked against Laravel MASTER for synchronized files.
- Headless DOM confirmed the five-language locale menu remained present.
- `git diff --check` passed.

Deploy state:
- Not committed / pushed / merged / deployed.

---

## 2026-09-30 — Table Order -> Cashier visibility repair

Symptom:
- A Table Order appeared in Kitchen but did not appear in Cashier.

Root cause:
- Public Table Order creation did not reliably persist `orderType: "table"`.
- Kitchen inferred table orders more permissively while Cashier required the explicit type.

Change:
- Public Table Order payload now includes `orderType: "table"` and `paymentStatus: "unpaid"`.
- `data-service.createTableOrder()` also enforces the same fields.
- Cashier and Kitchen table-order detection supports legacy orders with `tableCode + tableToken` but no explicit order type.
- Module versions were bumped so customer ordering does not reuse the stale create-order path.

Verification:
- Runtime verified the same Table 01 round in both Kitchen and Cashier.
- Cashier showed the same 375.00 total seen in Kitchen.
- React foundation / operational tests and build passed during this work.

Deploy state:
- Local only; no production deploy.

---

## 2026-09-30 — Cashier/Kitchen notification bell stability + sound

Symptom:
- Cashier bell caused Chrome to appear/freeze.
- Kitchen initially had no notification bell.
- Toggle toast looked like a blocking overlay.
- After safe-mode repair, incoming orders initially had no sound.

Investigation:
- Earlier click path invoked browser audio/notification/speech APIs.
- Toggle toast remained visible for several seconds.
- Plain `HTMLAudioElement.play()` on later Firestore events was subject to Chrome autoplay policy.

Change:
- Added the same notification control to Kitchen.
- Reworked notifier so toggle itself is state/localStorage only, with no toggle toast.
- Removed AudioContext, speechSynthesis, Notification permission requests, and vibration.
- Restored incoming-order sound with standalone `public/assets/audio/order-notification.wav` through `HTMLAudioElement`.
- Added silent user-gesture audio unlock when enabling the bell so later Firestore-triggered playback is allowed.
- Current storage key: `food_order_order_alerts_enabled_v3`.

Verification:
- Cashier and Kitchen both render the bell.
- Multi-click testing left Chrome responsive.
- Toggle no longer shows toast.
- Audio asset returns HTTP 200 with `audio/wave`.
- User confirmed the notification system works.
- React foundation / operational tests, build, and `git diff --check` passed during the repair.

Deploy state:
- Local only; no production deploy.

---

## 2026-09-30 — Delivery free-gift mandatory selection hardening

Symptom:
- Delivery order could be submitted while a free-gift promotion was active even if no gift was selected.

Root cause:
- Existing logic enforced only the maximum gift count.
- Firebase `createDeliveryOrder()` accepted empty `freeGiftMenuIds` and did not independently validate the active promotion.

Required behavior:
- When a free-gift promotion is active and at least one configured gift menu is available, choose at least one gift before continuing.

Change:
- Added client guard to disable submit while required gift selection is empty.
- Added required-message state below the free-gift selector.
- Added the same guard before payment-lock/review.
- Added service-level validation in `data-service.createDeliveryOrder()`.
- Service rejects zero selection, over-limit selection, and invalid gift IDs.
- Service strips browser-supplied gift items and rebuilds zero-price gift items from current menu master data.
- Added `gift_required` translations for all 5 public locales and required/error styling.
- Bumped Delivery module/cache versions.

Important files:
- `public/assets/js/delivery.js`
- `public/assets/js/delivery-payment-lock.js`
- `public/assets/js/data-service.js`
- `public/assets/js/public-storefront-service.js`
- `public/assets/js/public-translations.js`
- `public/assets/css/delivery-promotions.css`
- `public/delivery/index.html`

Verification:
- JS syntax checks passed.
- Five-language `gift_required` translation lookup passed.
- `git diff --check` passed.
- User runtime re-test remains the final confirmation.

Deploy state:
- Local only; no production deploy.

---

## 2026-09-30 — Whole-order cancellation converted to fast soft-cancel

Request:
- Avoid destructive order deletion and improve slow whole-order cancellation.
- Keep cancelled order data for audit while excluding it from active screens and sales reporting.

Investigation:
- React/Firebase was already setting `status: "cancelled"` instead of deleting the order document.
- Slowness came partly from the generic update helper doing Firestore write -> immediate getDoc read-back, plus table cleanup.
- Kitchen whole-order cancel also zeroed monetary totals, losing useful audit values.

Change:
- Added `cancelOperationalOrder()` with one Firestore write and no immediate read-back.
- Records `cancelledAt`, `cancelledByUid`, `cancelledByEmail`.
- Preserves original items and monetary totals.
- Cashier and Kitchen update UI optimistically so cancelled cards disappear immediately.
- On write failure, optimistic state is reverted.
- Kitchen no longer overwrites subtotal / delivery fee / total with zero for whole-order cancellation.
- Sales Report explicitly rejects `status: cancelled` even if legacy payment flags indicate paid.
- Table-session release remains when the cancelled order was the last active order for that table.

Important files:
- `react-app/src/data/operationalData.js`
- `react-app/src/pages/CashierPage.jsx`
- `react-app/src/pages/KitchenPage.jsx`
- `react-app/src/pages/AdminSalesReportPage.jsx`

Verification:
- `npm run test:operational` passed.
- `npm run test:react-foundation` passed.
- `npm run build:react` passed.
- `git diff --check` passed.
- User runtime performance re-test remains useful.

Deploy state:
- Local only; no commit / push / merge / deploy.

---

---

## 2026-09-30 — Canonical production URL cutover without /react

Request:
- Commit, push, and deploy the current Firebase migration while keeping existing customer/staff URLs unchanged and removing `/react` from normal navigation.

Routing decision:
- Canonical production URLs are the existing paths without `/react`.
- Customer storefront remains `/s/{slug}/order`, `/s/{slug}/delivery`, `/s/{slug}/takeaway`.
- Migrated operational routes including `/login`, `/register`, `/cashier`, `/kitchen`, `/waiting-queue`, `/admin`, `/platform`, `/reports/...`, and `/super-admin/saas-setup` now serve the React entry shell on their original URLs.
- `/react/**` remains only as a backward-compatible alias; React startup canonicalizes it to the path without `/react`.
- `/pos` intentionally remains on the legacy entrypoint because Retail POS is still paused at the documented checkpoint.

Implementation:
- Removed `/react` from React navigation/auth redirects and canonical route targets.
- Added `tools/sync-react-legacy-entrypoints.py`.
- Added npm `postbuild:react` so every React build synchronizes the React entry shell to all migrated legacy index paths.
- Updated Firebase Hosting rewrites and no-cache headers for the canonical migrated routes.
- Kept static customer storefront rewrites unchanged.
- Updated browser/contracts to test canonical no-`/react` URLs.
- Fixed missing nested static entrypoint synchronization for Admin Revenue Share, Admin Sales Report, Admin Users, Waiting Queue Customer, and Waiting Queue Display.

Release identity before Hosting deploy:
- React Version `0.4.280` • Build `2026.09.30.293` (final canonical-auth correction deploy build).
- Public storefront Version `0.16.32` • Build `2026.09.30.008` (final canonical-auth correction deploy build).
- Release marker: `CANONICAL-URL-CUTOVER`.

Verification before commit/deploy:
- `npm run test:operational` passed.
- `npm run test:react-parity` passed.
- `npm run build:react` passed; 131 modules.
- Canonical emulator routes `/login`, `/cashier`, `/kitchen`, `/admin`, `/platform`, `/waiting-queue` returned the React build.
- `/pos` remained legacy.
- Existing customer URLs for Order / Delivery / Takeaway returned HTTP 200 without `/react`.
- Playwright P0 browser smoke passed 52/52 on canonical routes.
- `git diff --check` passed.

Post-deploy correction:
- First Hosting release exposed one remaining legacy static entry at `/reports/revenue-share`.
- Added `public/reports/revenue-share/index.html` to the automatic React legacy-entry sync.
- Bumped Build again before the corrective Hosting deploy; Version stayed unchanged.

Canonical auth-return correction:
- Production verification showed canonical protected pages redirected to `/login` but still carried `next=/react/...` in the query string.
- Removed `/react` from all protected-route login return paths and from `RequireRole` return-path generation.
- Bumped Build again before this Hosting correction; Version stayed unchanged.

Deployment scope:
- Hosting only.
- Firestore Rules, Storage Rules, and Cloud Functions are deliberately not part of this deploy because the worktree contains backend/POS migration changes that are not all intended for this production cutover.

Deploy state:
- Main migration commit: `d8c5eaf4` — `feat: migrate customer flows and canonical firebase routes`.
- Revenue Share static-entry correction: `2d94caa4` — `fix: sync revenue share canonical entrypoint`.
- Canonical auth-return correction: `3ece7604` — `fix: canonicalize auth return paths`.
- All three commits were pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` was deployed successfully to `https://natchanon-food-order-delivery.web.app`.
- Final deployed release identity: React Version `0.4.280` / Build `2026.09.30.293`; public storefront Version `0.16.32` / Build `2026.09.30.008`.
- Final production shell hash observed on migrated operational routes: `index-CdjJ8_3Y.js`.
- Production verification: `/login`, `/cashier`, `/kitchen`, `/waiting-queue`, `/admin`, `/admin/sales-report`, `/platform`, and `/reports/revenue-share` returned HTTP 200 with the same React shell.
- Existing customer URLs `/s/saas-test-shop/order`, `/delivery`, and `/takeaway` returned HTTP 200 without requiring `/react`.
- `/pos` intentionally remained the legacy POS entrypoint.
- Canonical anonymous `/cashier` redirects to `/login?next=%2Fcashier`; compatibility `/react/cashier` also resolves to the same canonical login return path.
- Final route/auth browser gate passed 37/37 after the auth-return correction; the earlier full P0 browser suite passed 52/52.
- No merge to `main` was performed.
- No Firestore Rules, Storage Rules, or Cloud Functions were deployed as part of this cutover.
- The first Hosting deploy emitted a warning that rewrite function `lalamoveWebhook` had no valid endpoint. Hosting still deployed successfully. Treat `/api/lalamove/webhook` as a follow-up dependency until that Function is deliberately deployed/verified; do not deploy all local Functions just to silence this warning.

## 2026-09-30 — Canonical no-/react Hosting redeploy preparation

Request:
- Commit, push, and deploy the current Firebase production build while preserving the existing customer URLs without requiring `/react`.

Routing requirement:
- Customer storefront URLs remain `/s/{slug}/order`, `/s/{slug}/delivery`, `/s/{slug}/takeaway`, and `/s/{slug}/delivery/success`.
- Canonical operational routes remain `/login`, `/cashier`, `/kitchen`, `/admin`, `/platform`, `/waiting-queue`, and other migrated legacy paths without `/react`.
- `/react/**` remains compatibility-only and must not be required for existing customers.

Release identity for this redeploy:
- React Version `0.4.280` • Build `2026.09.30.294`.
- Public storefront Version `0.16.32` • Build `2026.09.30.009`.
- Version unchanged because this is a redeploy of the existing canonical-cutover milestone; Build increased to satisfy the mandatory unique Hosting-build rule.

Deployment scope:
- Firebase Hosting target `foodapp` only.
- Do not deploy Firestore Rules, Storage Rules, or Cloud Functions as part of this action.

Verification:
- `npm run test:operational` passed.
- `npm run test:react-parity` passed.
- `npm run build:react` passed; 131 modules and canonical legacy entrypoints were synchronized.
- `git diff --check` passed.
- Local Hosting emulator returned HTTP 200 for canonical `/login`, `/cashier`, `/kitchen`, `/admin`, `/platform`, and `/waiting-queue` routes without `/react`.
- Existing customer URLs `/s/saas-test-shop/order`, `/s/saas-test-shop/delivery`, and `/s/saas-test-shop/takeaway` returned HTTP 200 without `/react`.

Deploy state:
- Release commit: `98e68180` — `chore: prepare canonical hosting redeploy`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://natchanon-food-order-delivery.web.app`.
- Production verification returned HTTP 200 for canonical no-`/react` operational routes and the existing customer Order / Delivery / Takeaway URLs.
- Production public storefront identity verified as Version `0.16.32` / Build `2026.09.30.009`.
- Production React bundle verified to contain Build `2026.09.30.294`.
- Hosting emitted the known warning that rewrite function `lalamoveWebhook` has no valid endpoint; Hosting release still completed successfully. No Functions were deployed in this action.
- Firestore Rules, Storage Rules, and Cloud Functions were not deployed.
- No merge to `main` was performed.

---

## 2026-09-30 — React Table Order production-test preparation

Request:
- Move the existing customer Table Order URL to React while preserving the canonical URL `/s/{slug}/order`.
- Prepare a Firebase Hosting build for cross-device and mobile testing before continuing Takeaway / Delivery / Delivery Success and before resuming Retail POS.

Implementation:
- Added `react-app/src/pages/PublicOrderPage.jsx`.
- Added shared public storefront UI in `react-app/src/components/PublicStorefront.jsx`.
- Added public tenant/menu/table/order Firebase data layer in `react-app/src/data/publicStorefrontData.js`.
- Firebase Hosting rewrites for both `/s/*/order` and compatibility `/s/*/react/order` now target `/react/index.html`.
- Table session lookup supports the active table by `tableToken`, preserving moved-table sessions.
- Existing table order history is read through table `orderIds`; paid/cancelled orders stay excluded from the active customer view.
- Existing pending-order ID protection is preserved for retry safety.
- Added React storefront parity CSS assets and repaired the parity sync runtime-CSS extractor.
- Added `public-storefront-overrides.json` so the mandatory free-gift translation cannot be lost when syncing translations from Laravel MASTER.

Local verification completed before GitHub push:
- React production build completed with 134 modules.
- `git diff --check` passed after parity-sync EOF normalization.
- Canonical local URL `/s/saas-test-shop/order?table=01&token=...` loaded the React shell.
- Active Table 01 session resolved correctly.
- 37 menu items loaded with desktop pagination.
- Existing round history rendered: 1 previous round, total 375.00.
- Add item, quantity increment, cart total, and toast interaction worked in browser probe.
- No extra test order was submitted during the UI probe.
- Compatibility `/s/{slug}/react/order` is retained only as a redirect/compatibility path; customers should continue using the canonical URL without `/react`.

Git state:
- User pushed the migration checkpoint as commit `acf05c18` (`upload final react project`) to `origin/feature/react-firebase-port`.
- No merge to `main`.

Release preparation:
- React Version `0.4.280` • Build `2026.09.30.295`.
- Public storefront Version `0.16.32` • Build `2026.09.30.010`.
- Build numbers were increased because `294 / 009` were already deployed previously.
- Full operational/parity test suites still need to be rerun before treating this as a final release; this deployment is specifically for Order React cross-device/mobile verification.

Deployment scope:
- Firebase Hosting target `foodapp` only.
- Do not deploy Firestore Rules, Storage Rules, or Cloud Functions.
- Takeaway, Delivery, Delivery Success, and Retail POS are not part of this Order-only React test cutover.

Deploy state:
- GitHub release-preparation commits created after `acf05c18`: `1454b95b` (React build 295), `707d18b5` (public build 010), `286ac46c` (release contract), `bdf19e5a` (WORKLOG checkpoint), `fd2d2d99` (generated React bundle build stamp).
- Final build commit from the Mac: `affb7d25` — `build: finalize Order React test deploy`.
- User confirmed the Firebase Hosting deployment completed after that commit.
- Generated React shell now references `/react/assets/index-BoWOX-Jp.js`.
- React source identity remains Version `0.4.280` / Build `2026.09.30.295`; public storefront identity remains Version `0.16.32` / Build `2026.09.30.010`.
- Production cross-device/mobile verification is now the active test phase.
- Assistant-side live HTTP verification could not be completed at this checkpoint because the external web fetch path could not access the Firebase web.app host and Desktop Commander commands remain paused by its monthly quota; do not treat this as a failed deploy.
- Firestore Rules, Storage Rules, and Cloud Functions were not intended to be deployed in this Order-only test cutover.

---

## 2026-09-30 — Mobile Sales Report header one-row alignment

Symptom / request:
- On the React Admin Sales Report at mobile width, the FOD mark was visually off-center on the Y axis.
- Language/profile actions wrapped to a second row; the requested header/action bar is a single row.

Root cause:
- Shared `super-admin-header.css` forced `.super-admin-header-leading` to `flex: 1 1 100%` and `width: 100%` below 768px, which consumed the entire first row and pushed `.app-header-actions` below it.
- The FOD label relied on the generic brand-mark grid/pseudo-element alignment and was not explicitly centered by the shared Super Admin header layer.

Change:
- Made the Super Admin mobile header `flex-wrap: nowrap`.
- Changed the leading block back to `flex: 1 1 auto` / `width: auto`.
- Kept brand, back button, locale switcher, and profile actions on one row.
- Added compact mobile gaps and title ellipsis protection so narrow screens do not force another row.
- Explicitly centered `.brand-mark` and `.brand-mark::after` with inline-flex/flex on both axes.
- Synchronized both React parity source and built public parity CSS.

Important files:
- `react-app/public/parity/css/super-admin-header.css`
- `public/react/parity/css/super-admin-header.css`

Verification:
- CSS rule review confirms the previous 100%-width mobile row break was removed.
- Runtime visual verification remains to be performed on the user's 440px mobile viewport after pulling this branch.
- No Firebase deploy was performed for this CSS-only correction yet.

Git state:
- GitHub commits: `52894f51` (source parity CSS), `b642c996` (public React parity CSS).
- Branch: `feature/react-firebase-port`.
- No merge to `main`.

Remaining:
- Pull latest branch on the Mac and refresh the mobile emulator / real phone.
- If approved, bump Build before the next Firebase Hosting deploy.

---

## 2026-09-30 — Global FOD brand-mark vertical centering

Symptom / request:
- The FOD mark appeared too low on the Y axis across multiple pages, not only the Sales Report.
- The fix must apply everywhere the shared FOD brand mark is rendered.

Root cause:
- The shared `.brand-mark` still used grid/pseudo-element text rendering in base CSS.
- Even where the container was mathematically centered, the FOD/Kanit glyph baseline made the text appear optically low.
- Page-specific header fixes were insufficient because the same brand mark is shared across many React and remaining static/legacy surfaces.

Change:
- Added a global React runtime rule in `PlatformBrandingRuntime` so every React route forces `.brand-mark` to inline-flex center on both axes.
- The FOD `::after` content now fills the mark, centers with flex, uses line-height 1, and receives a 1px upward optical correction.
- Dynamic platform logo images remain centered with `object-position: center center` and are not given the text optical transform.
- Updated shared React parity `app.css` source and built public copy.
- Updated static/legacy `public/assets/css/app.css` and `system-controls.css` so remaining non-React surfaces follow the same alignment.

Important files:
- `react-app/src/components/PlatformBrandingRuntime.jsx`
- `react-app/public/parity/css/app.css`
- `public/react/parity/css/app.css`
- `public/assets/css/app.css`
- `public/assets/css/system-controls.css`

Git state:
- `8e62dc5e` — global React branding runtime alignment.
- `c1fc234c` — React parity source app.css.
- `516cc7d0` — built React parity app.css.
- `29be4a11` — shared static/legacy app.css.
- `b54f425f` — legacy system controls optical alignment.
- Branch: `feature/react-firebase-port`.
- No merge to `main`.

Verification:
- Source review confirms React runtime mounts `PlatformBrandingRuntime` above the router, so the rule applies to all React pages.
- Static/legacy shared CSS contains the same centered brand-mark treatment.
- Visual runtime verification remains required after pulling/building because Desktop Commander command execution is still paused by its service quota.

Deploy state:
- Not deployed yet.
- Build number must be increased before the next Firebase Hosting deployment.

---

## 2026-09-30 — Temporary MCP fallback delivery workflow

Request:
- Until Desktop Commander MCP command execution is available again, every completed change must include copy-paste commands for pulling the latest branch and deploying Firebase Hosting from the user's Mac.

Rule:
- Always provide:
  - `git pull --ff-only origin feature/react-firebase-port`
  - `npx firebase-tools deploy --only hosting:foodapp --project chat-45754`
- If the change requires a new Hosting release, include the required Build bump and test/build gate before the deploy command.
- Keep deployment scoped to Hosting unless the user explicitly requests Rules / Storage / Functions.

Deploy state:
- Documentation/process change only; no Firebase deploy performed by this entry.

---

## 2026-09-30 — Use uploaded App Icon for global header brand mark

Symptom / request:
- The FOD text mark still appeared visually low even after global Y-axis centering.
- Super Admin already provides an App Icon upload, so the header should use that real asset instead of relying on generated FOD text.

Root cause:
- `PlatformBrandingRuntime` applied `logoUrl` to both `.brand-mark` and `.login-logo`.
- `appIconUrl` was only used for favicon / apple-touch-icon fallback and never for the visible header mark.
- When no logo was configured, headers therefore fell back to CSS-generated `FOD`.

Change:
- Added target-specific branding:
  - `.brand-mark` uses uploaded `appIconUrl` first, then `logoUrl`, then CSS `FOD` fallback.
  - `.login-logo` uses `logoUrl` first, then `appIconUrl`.
- Favicon fallback is now favicon -> App Icon -> Logo.
- Existing image centering remains `object-fit: contain` / center-center.
- Bumped React Build to `2026.09.30.296`.
- Bumped public storefront Build to `2026.09.30.011`.
- Updated React foundation release contract to Build 296.

Important files:
- `react-app/src/components/PlatformBrandingRuntime.jsx`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `tools/react-foundation-contract.mjs`

Git state:
- `72a5ab32` — use App Icon in global header branding.
- `72a36328` — React Build 296.
- `ac38458f` — public Build 011.
- `a845b1d1` — release contract alignment.
- Branch: `feature/react-firebase-port`.
- No merge to `main`.

Verification:
- Source inspection confirms App Icon is now the first-choice asset for every React `.brand-mark`.
- Existing uploaded App Icon will be applied automatically after the runtime loads platform branding.
- Full browser/build verification must be run on the Mac before deploy while Desktop Commander MCP commands remain unavailable.

Deploy state:
- Not deployed yet.
- Next Hosting deploy must build React with Build 296 before deployment.

---

## 2026-09-30 — KINJAI brand rollout

Decision:
- Public product brand is now **KINJAI**.
- Branding/UI names change first; repository names, Firebase project IDs, Firestore schema, translation keys, DOM/data identifiers, and other internal identifiers remain unchanged unless separately migrated later.

Change:
- Replaced visible React branding `LUKKAJA / FOD / FOOD ORDER QR` with `KINJAI / KJ / KINJAI QR` across Home, Login, Register, Platform, Admin, Sales Report, QR, Revenue Share, Waiting Queue, tenant/platform management, receipt, and SaaS setup surfaces.
- Public Storefront header fallback changed to `KJ`.
- Platform branding runtime image alt/fallback naming changed to KINJAI while keeping uploaded App Icon as the primary header asset.
- Renamed public/static page titles and visible branding to KINJAI, including Delivery, Delivery Success, Takeaway, Verify, Privacy, Terms, Platform compatibility pages, and Revenue Share.
- Public translation fallback names now use KINJAI in all supported locales.
- Platform static translations changed from FOD platform naming to KINJAI.
- Shared CSS fallback mark changed from `FOD` to compact `KJ` across React parity and remaining static/legacy bundles.
- Existing internal identifiers such as `fod-login-email`, `data-delete-fod-wallet-topup`, and `fod_wallet_*` translation keys were intentionally preserved.
- If the currently uploaded App Icon image itself still contains old FOD artwork, Super Admin must upload a new KINJAI App Icon; runtime wiring is already ready to use it globally.

Release preparation:
- React Version `0.4.280` • Build `2026.09.30.297`.
- Public storefront Version `0.16.32` • Build `2026.09.30.012`.
- Public milestone set to `KINJAI branding rollout`.
- React foundation release contract aligned to Build 297.

Verification:
- React source audit found old FOD text only in preserved internal identifiers, not visible branding.
- Public/static audit found no LUKKAJA/FOD brand labels remaining in the checked customer/platform/admin pages.
- Shared CSS audit confirms zero `content: "FOD"` fallbacks and `KJ` fallback is present in all checked source/public bundles.
- Full test/build/runtime verification remains required on the Mac after pulling because Desktop Commander command execution is unavailable.

Deploy state:
- Not deployed yet.
- Hosting-only deployment is expected after local test/build and generated React asset refresh.
- No Firestore Rules, Storage Rules, Functions, or merge to `main` are part of this branding rollout.

---

## 2026-09-30 — KINJAI build-regression cleanup

Symptom / request:
- Finish the KINJAI visible-brand rollout after the generated React build reintroduced legacy product names.
- Preserve all internal identifiers and compatibility contracts such as `fod-login-email`, `fod_wallet_*`, `FOD_WALLET_*`, Firebase project IDs, repository names, Firestore schema, and DOM/data identifiers.

Root cause:
- `react-app/index.html` still used `<title>LUKKAJA</title>`. The React build produced the same title in `public/react/index.html`, and `postbuild:react` copied that shell to canonical compatibility entrypoints. Commit `c4dbe31d` therefore regenerated multiple KINJAI page titles back to LUKKAJA while refreshing the hashed bundle.
- `react-app/src/i18n/parity-translations.json` still contained visible LUKKAJA branding across TH / EN / MY / LO / KM plus five visible FOD fallback-help strings.
- Several remaining static helpers/translations still exposed `Food Order/Delivery With QR` in QR print branding, shared footers, Home staff branding, Waiting Queue, Cashier documents, Kitchen, and Cashier translations.
- React/public release metadata still exposed `Food Order Delivery`.

Change:
- Set the React source shell title to `KINJAI` and synchronized the current built React shell to all canonical entrypoints generated by `tools/sync-react-legacy-entrypoints.py`.
- Replaced visible legacy product branding in the React parity translation values for all five supported locales while preserving internal FOD-prefixed keys/error codes.
- Added `normalizeVisibleBranding()` to `I18nProvider` as a runtime guard so future Laravel parity synchronization cannot surface LUKKAJA / FOD / old product-name strings without renaming internal keys.
- Updated React/public release product metadata to KINJAI.
- Updated remaining QR/footer/Home/Waiting Queue/Cashier/Kitchen visible brand strings to KINJAI.
- Added React foundation regression assertions for KINJAI home metadata, no visible legacy branding in translation values, the KINJAI React entry title, runtime branding normalization, and the corrected release Build.
- Prepared a fresh Hosting identity: React Version `0.4.280` / Build `2026.09.30.298`; public storefront Version `0.16.32` / Build `2026.09.30.013`.

Important files:
- `react-app/index.html`
- `react-app/src/i18n/parity-translations.json`
- `react-app/src/i18n/I18nProvider.jsx`
- `react-app/src/config/release.js`
- `tools/react-foundation-contract.mjs`
- `public/react/index.html`
- canonical React entrypoints under `public/login`, `public/register`, `public/cashier`, `public/kitchen`, `public/waiting-queue`, `public/admin`, `public/platform`, `public/reports/revenue-share`, and `public/super-admin/saas-setup`
- `public/assets/js/app-info.js`
- `public/assets/js/admin-delivery-qr.js`
- `public/assets/js/app-footer.js`
- `public/assets/js/home-session-fa.js`
- `public/assets/js/waiting-queue-translations.js`
- `public/assets/js/cashier-documents-translations.js`
- `public/assets/js/kitchen-translations.js`
- `public/assets/js/cashier-translations.js`
- `README.md`
- `docs/NEXT_CHAT_HANDOFF.md`

Verification:
- GitHub source audit confirms the corrected React parity translation blob contains zero `LUKKAJA`, zero old Food Order product phrases, and zero standalone visible `FOD`; internal `FOD_WALLET_*` codes remain present.
- Source shell and synchronized canonical entry shells now use `<title>KINJAI</title>`.
- Known React page residuals containing FOD are internal IDs, account-mode values, translation keys, or backend error codes and were intentionally preserved.
- Full `npm run test:operational`, `npm run test:react-parity`, `npm run build:react`, and `git diff --check` could not be executed by the assistant because Desktop Commander reported that monthly Remote MCP command usage is paused. They must be run on the Mac after pulling.
- Runtime visual verification of uploaded App Icon headers, Login Logo, favicon/apple-touch-icon, and TH/EN/MY/LO/KM switching remains required after rebuilding.

Deploy state:
- Branding regression fix commit: `28ae96f2` — `fix: prevent KINJAI branding regression`.
- Regression-contract follow-up: `f432a7c5` — `test: tighten KINJAI branding guard`; corrected the standalone `FOD` word-boundary assertion so future translation regressions are detected.
- Commit pushed to `origin/feature/react-firebase-port` by fast-forward GitHub ref update.
- No merge to `main`.
- No Firebase Hosting, Firestore Rules, Storage Rules, or Functions deployment performed in this action.
- The checked-in generated JavaScript bundle has not been rebuilt from the corrected source in this GitHub-only step; run `npm run build:react` on the Mac and commit generated changes before Hosting deploy.

Remaining:
- Pull the branch on the Mac, run operational/parity tests, build React, and run `git diff --check`.
- Commit/push generated build output if it changes.
- Verify App Icon in every React header, Logo on Login/large-brand surfaces, favicon/apple-touch-icon fallback order, and all five locales.
- Deploy Hosting target `foodapp` only after the rebuilt output is committed.

---

## 2026-10-01 — KINJAI residual visible-brand cleanup

Symptom / request:
- Continue the KINJAI rename after the previous GitHub-side rollout and confirm remaining visible FOD / LUKKAJA / Food Order strings.

Root cause:
- HEAD `d66bdf90` (`build: finalize KINJAI branding`) already covered the main React/static title/fallback rename, but leftover visible product strings remained in POS overlays, page-title default, Delivery QR print brand, Waiting Queue footer product names, QR ticket brand, home translations, receipt/offline shop-name fallbacks, and one Sales Report parity CSS `content: "FOD"` rule.
- Old hashed React bundles under `public/react/assets/index-*.js` still contained LUKKAJA/FOD because they were generated before this cleanup.

Change:
- Visible leftovers now use KINJAI / KJ / KINJAI QR.
- Internal identifiers such as `fod-login-email`, `fod_wallet_*`, `FOD_WALLET_*`, Firebase project IDs, repo names, and translation keys were not renamed.
- Bumped Hosting identity before the next deploy: React `0.4.280 / 2026.09.30.299`; public storefront `0.16.32 / 2026.09.30.014`.

Important files:
- `react-app/src/pages/PosPage.jsx`
- `react-app/src/pages/PosCatalogPage.jsx`
- `react-app/src/pages/PosProductsPage.jsx`
- `react-app/src/hooks/useParityPage.jsx`
- `react-app/src/components/AdminDeliveryQr.jsx`
- `react-app/src/i18n/waiting-queue-translations.js`
- `react-app/public/parity/css/admin-sales-report-retail-pos-parity.css`
- `public/react/parity/css/admin-sales-report-retail-pos-parity.css`
- `public/assets/js/qr.js`
- `public/assets/js/cashier-table-qr.js`
- `public/assets/js/home-translations.js`
- `public/assets/js/offline-data-service.js`
- `public/assets/js/receipt.js`
- `public/assets/js/receipt-combined.js`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `tools/react-foundation-contract.mjs`

Verification:
- `npm run test:operational` passed.
- `npm run test:react-parity` passed after aligning the branding-image assertion with the existing `content:none` + `transform:none` runtime CSS.
- `npm run build:react` passed and produced `public/react/assets/index-DkeByQfC.js`.
- `git diff --check` passed.
- Source-level leftover visible LUKKAJA / FOOD ORDER QR / Food Order Delivery strings were removed except the I18n runtime `normalizeVisibleBranding()` replace list.

Deploy state:
- Commit/push pending after this worklog update.
- No merge to `main`.
- Hosting-only deploy remains pending.

Remaining:
- Push `feature/react-firebase-port`, then deploy Hosting `foodapp` only.
- Visual-check uploaded App Icon headers, Login Logo, favicon/apple-touch-icon, and TH/EN/MY/LO/KM after deploy.
- If the uploaded App Icon artwork still contains FOD, Super Admin must upload a new KINJAI App Icon.

---

## 2026-10-01 — KINJAI static customer page brand-mark fallback

Symptom / request:
- Continue the KINJAI rename in a new chat: verify what the previous rounds left behind and remove residual visible FOD / LUKKAJA / Food Order strings without touching internal identifiers.

Root cause:
- Local HEAD at the start of this session was `d66bdf90` (`build: finalize KINJAI branding`), with the 2026-10-01 residual cleanup already present in the working tree.
- Three legacy static customer pages still rendered the old generated fallback `FO` inside `.brand-mark` (the same fallback that the rollout replaced with `KJ` everywhere else): `public/order/index.html`, `public/takeaway/index.html`, `public/queue/index.html`.

Change:
- Changed `<span class="brand-mark">FO</span>` to `<span class="brand-mark">KJ</span>` in those three files. No other text or markup was touched.
- Audited, without changes needed: all React pages/components listed in the handoff, `public/assets/js/public-translations.js`, `public/assets/js/platform-translations.js`, every `public/**/index.html` (React shells, storefront, privacy/terms, verify, waiting-queue, cashier, kitchen, admin, super-admin, pos/*).
- Deliberately preserved internal identifiers: `fod-login-email`, `fod-login-secret`, `fod_central`, `fod_wallet_*`, `FOD_WALLET_*`, `data-delete-fod-wallet-topup`, `lalamoveFodWallet*` element ids, `lukkhaja_react_entry_recovery` (sessionStorage key) and `__lukkhajaReactEntryLoaded` (global callback used by the React entry shells).

Important files:
- `public/order/index.html`
- `public/takeaway/index.html`
- `public/queue/index.html`

Verification:
- Source-level scan by reading the files. The edit diffs were confirmed to change only the brand-mark line in each file.
- `npm run test:operational`, `npm run test:react-parity`, `npm run build:react`, and `git diff --check` were NOT run in this session (no command execution available). They must be run on the Mac.
- Runtime visual check of the three pages (header shows `KJ` or the uploaded App Icon) is still required.

Deploy state:
- No git command was run. Not committed / pushed / merged / deployed.
- Build identity was not bumped in this entry: pending release identity remains React `0.4.280 / 2026.09.30.299` and public storefront `0.16.32 / 2026.09.30.014`. If that identity was already deployed, bump Build before the next Hosting deploy.

Remaining:
- Run the test/build gate on the Mac, commit, then deploy Hosting `foodapp` only.
- `react-app/src/pages/HomePage.jsx` still contains a redundant ternary `{staff ? "KINJAI" : "KINJAI"}` in `.brand-label`; it renders correctly and was left untouched.
- Verify App Icon / Logo / favicon / apple-touch-icon and TH/EN/MY/LO/KM after deploy. If the uploaded App Icon artwork still contains FOD, upload a new KINJAI App Icon from Platform Branding.

---

## 2026-10-01 — Static footer i18n module-instance repair

Symptom / request:
- The Home / staff dashboard footer rendered raw translation keys such as `shared.footer.product • shared.footer.version • shared.footer.build • shared.footer.icon_credit` instead of the KINJAI release text.
- User requested that clear defects be repaired directly after diagnosis and that every completed change include pull/test/build/deploy commands.

Root cause:
- `public/assets/js/ui.js` created the shared static footer from an `i18n.js?v=20260930-001` ES-module instance.
- `public/assets/js/home-session-fa.js` configured translations through `i18n.js?v=20260903-202`.
- Different query strings create distinct browser ES-module instances. The Home translation dictionary was therefore configured in one instance while the Footer called `t()` from another instance whose local dictionary was empty, causing `t()` to return the key names themselves.

Change:
- Made static `i18n.js` read the current shared `globalThis.APP_I18N_DICTIONARIES` dictionary instead of relying only on module-local state.
- Added global i18n configured / locale-changed events so shared UI can refresh after another module configures translations.
- Changed the shared static Footer to render safe KINJAI / Version / Build / Uicons fallbacks immediately and re-render from translations when i18n becomes available.
- Aligned Home `ui.js`, `home-session-fa.js`, and `locale-switcher-static.js` on `i18n.js?v=20261001-001` and cache-busted the Home entry scripts.
- Prepared a fresh Hosting identity: React `0.4.280 / 2026.10.01.300`; public storefront `0.16.32 / 2026.10.01.015`.
- Updated the React foundation release contract and current handoff/release documentation.

Important files:
- `public/assets/js/i18n.js`
- `public/assets/js/ui.js`
- `public/assets/js/home-session-fa.js`
- `public/assets/js/locale-switcher-static.js`
- `public/index.html`
- `public/assets/js/app-info.js`
- `react-app/src/config/release.js`
- `tools/react-foundation-contract.mjs`
- `README.md`
- `docs/NEXT_CHAT_HANDOFF.md`

Verification:
- GitHub source inspection confirmed the reported footer keys exist in the Home translation dictionary for TH / EN / MY / LO / KM.
- Source guard confirms the Footer no longer exposes raw keys when a dictionary is not ready and will refresh when i18n configuration becomes available.
- Added `react-foundation-contract.mjs` regression assertions for the shared global dictionary, Footer fallback/refresh behavior, and Home's common `i18n.js?v=20261001-001` cache identity.
- Home static modules now share the same `i18n.js?v=20261001-001` cache identity.
- Full `npm run test:operational`, `npm run test:react-parity`, `npm run build:react`, and `git diff --check` must still be run on the Mac because Desktop Commander command execution remains unavailable.

Deploy state:
- Fix commit: `ba3b2e32` — `fix: restore localized static footer`.
- Regression guard commit: `71794169` — `test: guard static footer i18n state`.
- Branch: `feature/react-firebase-port`.
- No merge to `main`.
- No Firebase deployment performed by the assistant.
- Hosting-only deployment is the intended scope after the local test/build gate.

Remaining:
- Pull the branch on the Mac, run the test/build gate, and deploy Hosting target `foodapp`.
- Verify the footer on `/` in all five locales and confirm it shows KINJAI, Version, Build, and Uicons credit rather than translation keys.

---

## 2026-10-01 — Home session loading, five-locale menu, profile icon colors, and logout transition

Symptom / request:
- Static Home user-profile menu icons were falling back to nearly the same default color instead of the semantic per-menu colors already defined by the shared icon CSS.
- The Home language switcher exposed only Thai and English although the React application supports TH / EN / MY / LO / KM.
- Refreshing Home or navigating back to Home with an authenticated Firebase session briefly exposed the public landing page before the staff session/profile finished resolving.
- Logging out briefly exposed the unstyled React Login markup before `login-page.css` finished loading.

Root cause:
- Static `auth-service.js` rendered profile-menu links without `data-user-menu-key`, so the shared CSS selectors for Home / Waiting Queue / Table / Admin / Staff colors never matched.
- `public/index.html` hard-coded only the TH and EN locale choices, and `home-translations.js` contained only TH / EN.
- Static Home rendered the public landing immediately while `waitForAuth()` and `getUserProfile()` were still asynchronous.
- `LoginPage.jsx` called `useParityPage()` but ignored its `stylesReady` result, allowing the Login form to render before its page-specific CSS loaded.
- Logout redirected immediately after Firebase sign-out without a blocking transition state.

Change:
- Added semantic `data-user-menu-key` values to the static profile menu so the existing icon color palette now applies consistently with React.
- Static auth menu labels now resolve through shared i18n keys with safe Thai fallbacks.
- Expanded the static Home locale menu to Thai, English, Myanmar, Lao, and Khmer.
- Rebuilt `public/assets/js/home-translations.js` from the React parity dictionary for all five locales, including Home, Revenue Share, shared UI, and i18n date/locale data.
- Added an immediate full-screen Home auth/session loading overlay before any Home content is exposed. It stays visible while the Firebase session/profile resolves and remains visible through Super Admin redirects.
- Added a blocking logout loading overlay to both static auth and React `UserMenu`.
- React Login now keeps `PageReadyOverlay` visible until `login-page.css` reports ready through `useParityPage()`, preventing the raw unstyled Login form from flashing.
- Aligned the touched static Home/i18n cache identities on `20261001-002`.
- Added foundation regression assertions for five locales, static profile-menu semantic keys, Home session gating, Login CSS gating, and logout loading state.
- Prepared a fresh Hosting identity: React `0.4.280 / 2026.10.01.301`; public storefront `0.16.32 / 2026.10.01.016`.

Important files:
- `public/index.html`
- `public/assets/js/auth-service.js`
- `public/assets/js/home-session-fa.js`
- `public/assets/js/home-translations.js`
- `public/assets/js/locale-switcher-static.js`
- `public/assets/js/user-menu-i18n-static.js`
- `public/assets/js/ui.js`
- `react-app/src/components/UserMenu.jsx`
- `react-app/src/pages/LoginPage.jsx`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `tools/react-foundation-contract.mjs`
- `README.md`
- `docs/NEXT_CHAT_HANDOFF.md`

Verification:
- GitHub source inspection confirms all five locale options are present on static Home and all five locale dictionaries are present in `home-translations.js`.
- Static profile links now carry `data-user-menu-key`, which activates the existing semantic icon color rules in `icons.css`.
- Static Home contains the auth/session ready overlay and the bootstrap code removes it only after session resolution; Super Admin redirects keep it covering the page.
- React Login checks `stylesReady` and returns `PageReadyOverlay` before rendering the form.
- Static and React logout paths both establish a loading overlay before redirecting.
- Full `npm run test:operational`, `npm run test:react-parity`, `npm run build:react`, and `git diff --check` still need to run on the Mac because Desktop Commander command execution remains unavailable.

Deploy state:
- Implementation + regression guard commit: `ddfd4389` — `fix: stabilize home session and login transitions`.
- Branch: `feature/react-firebase-port`.
- No merge to `main`.
- No Firebase deployment performed by the assistant.
- Hosting-only deployment is intended after the local test/build gate.

Remaining:
- Pull the branch, run the local test/build gate, and deploy Hosting `foodapp`.
- Verify the profile-menu icon colors, all five locale options, authenticated Home refresh/back navigation, and Logout -> Login transition on desktop and mobile.

---

## 2026-10-01 — Delivery Hero uses tenant store name

Symptom / request:
- Customer Delivery page at `/s/{slug}/delivery` showed platform brand `KINJAI` inside the Hero card.
- The Hero card is store-facing content and must display the current tenant/store name instead.

Root cause:
- `public/delivery/index.html` hard-coded `KINJAI` directly in the Hero heading.
- Delivery runtime loaded `storeSettings` but never bound `shopName` or the resolved tenant name to the Hero.

Change:
- Replaced the hard-coded Hero brand with `#deliveryHeroStoreName`.
- Added `renderDeliveryStoreHero()` to `public/assets/js/delivery.js`.
- Store-name precedence is now:
  1. `storeSettings.shopName`
  2. resolved active tenant/store `name`
  3. localized `shared.store.fallback_name` / `ร้านอาหาร`
- Hydrates the Hero once immediately after tenant resolution, then re-renders after Store Settings finishes loading. This prevents a visible platform-brand or fallback flash while waiting for settings.
- Kept `KINJAI` in the application header/platform brand; only the tenant-facing Hero title changed.
- Added a React foundation regression assertion so the Delivery Hero cannot regress to a hard-coded KINJAI title.
- Prepared the next Hosting identity: React `0.4.280 / 2026.10.01.302`; public storefront `0.16.32 / 2026.10.01.017`.

Important files:
- `public/delivery/index.html`
- `public/assets/js/delivery.js`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `tools/react-foundation-contract.mjs`
- `README.md`
- `docs/NEXT_CHAT_HANDOFF.md`

Verification:
- GitHub source inspection confirms `public/delivery/index.html` no longer hard-codes `<span>KINJAI</span>` inside the Delivery Hero.
- Delivery runtime now references both `settings?.shopName` and `activeShop?.name`.
- The runtime hydrates the tenant name immediately and again after Store Settings loads.
- Full `npm run test:operational`, `npm run test:react-parity`, `npm run build:react`, and `git diff --check` still need to run on the Mac because Desktop Commander command execution remains unavailable.

Deploy state:
- Main fix commit: `75642f79` — `fix: show store name in delivery hero`.
- Immediate tenant-context hydration follow-up: `1f10f94b` — `fix: hydrate delivery hero from tenant context`.
- Branch: `feature/react-firebase-port`.
- No merge to `main`.
- No Firebase deployment performed by the assistant.
- Hosting-only deployment is intended after the local test/build gate.

Remaining:
- Pull the branch, run test/build, deploy Hosting `foodapp`, then verify the Delivery Hero shows the actual store name for multiple tenant slugs.

---

## 2026-10-01 — Delivery distance raw translation key cleanup

Symptom / request:
- Delivery page showed the raw key `delivery.checkout.distance.calculating` directly beneath the Google map while calculating route distance.

Root cause:
- `public/assets/js/delivery.js` called two distance-state translation keys that were completely absent from `public/assets/js/public-translations.js`:
  - `delivery.checkout.distance.calculating`
  - `delivery.checkout.distance.route_failed`
- The remaining distance keys used by Delivery were present in all five supported locales.
- Because the missing keys were not in the dictionary, `t()` correctly fell back to returning the key name itself.

Change:
- Added `calculating` and `route_failed` translations for TH / EN / MY / LO / KM.
- Audited every `delivery.checkout.distance.*` key currently called by `delivery.js`; all runtime distance keys are now represented in all five public dictionaries.
- Cache-busted the public translation/i18n chain used by Delivery so browsers cannot retain the old dictionary after deploy:
  - `public-translations.js?v=20261001-003`
  - `i18n.js?v=20261001-003`
  - `public-page-static-i18n.js?v=20261001-003`
  - `public-i18n-bootstrap.js?v=20261001-003`
  - `delivery.js?v=20261001-004`
- Added a foundation regression assertion requiring every Delivery distance runtime key to appear in all five public locales.
- Prepared a fresh Hosting identity: React `0.4.280 / 2026.10.01.303`; public storefront `0.16.32 / 2026.10.01.018`.

Important files:
- `public/assets/js/public-translations.js`
- `public/assets/js/public-page-static-i18n.js`
- `public/assets/js/public-i18n-bootstrap.js`
- `public/assets/js/delivery.js`
- `public/delivery/index.html`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `tools/react-foundation-contract.mjs`
- `README.md`
- `docs/NEXT_CHAT_HANDOFF.md`

Verification:
- Source audit found Delivery uses these distance keys: `calculating`, `fee_rule_missing`, `out_of_range`, `ready`, `ready_with_limit`, `route_failed`, `store_location_missing`, and `unavailable`.
- Before the fix, `calculating` and `route_failed` appeared 0 times in the public dictionary while the other required keys existed for all five locales.
- After the fix, both missing keys are populated for TH / EN / MY / LO / KM and the new regression contract enforces five-locale coverage.
- Full `npm run test:operational`, `npm run test:react-parity`, `npm run build:react`, and `git diff --check` still need to run on the Mac because Desktop Commander command execution remains unavailable.

Deploy state:
- Fix commit: `313e68e5` — `fix: restore delivery distance translations`.
- Branch: `feature/react-firebase-port`.
- No merge to `main`.
- No Firebase deployment performed by the assistant.
- Hosting-only deployment is intended after the local test/build gate.

Remaining:
- Pull the branch, run the local test/build gate, deploy Hosting `foodapp`, and verify the map status shows localized text instead of raw translation keys.

---

## 2026-10-01 — Cashier Receipt action icons restored

Symptom / request:
- React Cashier Receipt at `/cashier/receipt` no longer matched Laravel MASTER: the Back button and the green Print Receipt button rendered as text-only actions.
- User supplied the current React screenshot and the Laravel MASTER screenshot for visual comparison.

Root cause:
- `CashierReceiptPage.jsx` rendered both actions without icon markup:
  - Back was only the translated text inside the `Link`.
  - Print Receipt was only the translated text inside `#printButton`.
- This was a markup parity regression, not a CSS visibility problem.

Change:
- Restored the Laravel MASTER-style Back icon with `bi bi-arrow-left app-icon`.
- Restored the Laravel MASTER-style Print Receipt icon with `bi bi-check-lg app-icon`.
- Wrapped action labels in `<span>` to preserve the shared button icon/text spacing behavior.
- Added a React foundation regression assertion requiring both Receipt action icons.
- Prepared a fresh Hosting identity: React `0.4.280 / 2026.10.01.304`; public storefront `0.16.32 / 2026.10.01.019`.

Important files:
- `react-app/src/pages/CashierReceiptPage.jsx`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `tools/react-foundation-contract.mjs`
- `README.md`
- `docs/NEXT_CHAT_HANDOFF.md`

Verification:
- GitHub source inspection confirms the Back action now contains `bi-arrow-left`.
- GitHub source inspection confirms `#printButton` now contains `bi-check-lg`.
- The page already loads shared app/icon CSS, so no new CSS dependency is required.
- Full `npm run test:operational`, `npm run test:react-parity`, `npm run build:react`, and `git diff --check` still need to run on the Mac because Desktop Commander command execution remains unavailable.

Deploy state:
- Fix commit: `089bd5ed` — `fix: restore cashier receipt action icons`.
- Branch: `feature/react-firebase-port`.
- No merge to `main`.
- No Firebase deployment performed by the assistant.
- Hosting-only deployment is intended after the local test/build gate.

Remaining:
- Pull, test/build, deploy Hosting `foodapp`, then compare `/cashier/receipt` visually against Laravel MASTER on desktop and mobile.

---

## 2026-10-01 — Receipt icons existed in source but stale bundle was deployed

Symptom / request:
- After the React Cashier Receipt source was updated with Back and Print icons, production still showed both buttons as text-only.
- User confirmed the issue remained after the next Hosting deploy.

Root cause:
- The React source was correct:
  - Back contained `bi bi-arrow-left app-icon`.
  - Print Receipt contained `bi bi-check-lg app-icon`.
- The canonical `public/cashier/receipt/index.html` still referenced generated bundle `/react/assets/index-CS6qqkzb.js`.
- That bundle was stale:
  - it contained React release Build `2026.10.01.303`, not source Build `2026.10.01.304`;
  - its Cashier Receipt markup still rendered text-only Back / Print actions.
- Therefore the deployed page could not display the new icons even though the JSX source had already been fixed.
- The previous copy/paste command block also lacked `set -e`; a failed test/build chain could therefore be followed by a later deploy command in the same shell. That workflow is no longer acceptable.

Change:
- Added `tools/generated-react-build-contract.mjs`.
- The generated-artifact contract reads the canonical Cashier Receipt entrypoint, resolves the exact hashed React bundle referenced by that entrypoint, and verifies:
  - the bundle contains the current React release Build;
  - the Cashier Receipt Back action around `cashier_documents.receipt.back` contains `bi bi-arrow-left app-icon`;
  - the generated `printButton` area contains `bi bi-check-lg app-icon`.
- Added `npm run verify:react-build`.
- Extended `postbuild:react` so every `npm run build:react` now performs:
  1. canonical entrypoint sync;
  2. generated deploy-artifact verification.
- Added foundation coverage requiring the postbuild generated-artifact guard.
- Prepared a fresh Hosting identity: React `0.4.280 / 2026.10.01.305`; public storefront `0.16.32 / 2026.10.01.020`.
- Future deployment command blocks must use `set -euo pipefail` so any failed pull/test/build/verification stops before commit or Firebase deploy.

Important files:
- `tools/generated-react-build-contract.mjs`
- `package.json`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`
- `docs/NEXT_CHAT_HANDOFF.md`

Verification:
- GitHub source inspection confirms `CashierReceiptPage.jsx` has both required icons.
- Inspection of the currently referenced generated bundle `index-CS6qqkzb.js` confirms it still has text-only Receipt actions and carries Build `2026.10.01.303`, proving the production symptom came from a stale generated artifact.
- The new postbuild contract will fail the local build if the canonical deploy bundle is stale or missing either Receipt icon.
- Full local `npm run test:operational`, `npm run test:react-parity`, `npm run build:react`, generated contract execution, and `git diff --check` still need to run on the Mac.

Deploy state:
- Generated-artifact guard commit: `d2eb2155` — `build: verify generated receipt icon parity`.
- Minifier-safe guard follow-up: `1bd2fcc4` — `test: make generated receipt guard minifier-safe`.
- Branch: `feature/react-firebase-port`.
- No merge to `main`.
- No Firebase deployment performed by the assistant.
- Hosting-only deployment is intended after a fresh local React build generates and commits the new hashed bundle.

Remaining:
- Pull the branch, run the guarded test/build sequence, commit generated assets if changed, push, then deploy Hosting.
- Verify the deployed canonical Receipt entry references the new bundle and visually shows both icons.

---

## 2026-10-01 — Foundation test custom assert compatibility fix

Symptom / request:
- Local `npm run test:react-parity` stopped in `tools/react-foundation-contract.mjs` with:
  `TypeError: assert.equal is not a function`.

Root cause:
- This contract file defines its own assertion helper:
  `const assert=(condition,message)=>{if(!condition)throw new Error(message)};`
- A recently added Delivery distance translation regression check incorrectly used Node-style `assert.equal(...)`.
- The custom helper has no `.equal` method, so the test crashed before reaching the React build.

Change:
- Replaced `assert.equal(count,5,...)` with the contract's native style:
  `assert(count===5,...)`.
- Audited the entire file for other `assert.*(...)` method calls; none remain.
- Release identity remains React `0.4.280 / 2026.10.01.305` and public `0.16.32 / 2026.10.01.020` because the previous pipeline stopped before build/deploy and that release pair has not been deployed.

Verification:
- GitHub source audit confirms zero remaining `assert.<method>(...)` calls in `react-foundation-contract.mjs`.
- Local tests/build/deploy still need to be rerun on the Mac.

Deploy state:
- Fix commit: `42171757` — `test: fix foundation translation assertion`.
- Branch: `feature/react-firebase-port`.
- No merge to `main`.
- No Firebase deployment performed by the assistant.

Remaining:
- Pull the fix and rerun the guarded test/build/push/deploy sequence.

---

## 2026-10-01 — Home parity CSS loading flash removed

Symptom / request:
- Returning from `/reports/revenue-share` to Home briefly showed the dashboard in a pale / near-monochrome intermediate state before the normal semantic card colors appeared.
- The flash was short enough that it was difficult to capture, but reproducible during route navigation.

Root cause:
- `HomePage.jsx` called `useParityPage(...)` to load `home-dashboard.css`, `public-contact.css`, `public-utility-actions.css`, and `home-page.css`, but ignored the hook's `stylesReady` return value.
- React therefore rendered the Home dashboard immediately with only the already-loaded global CSS. The Home-specific semantic color rules arrived asynchronously a moment later, causing the visible white/grey -> colored transition.

Change:
- Home now stores `const stylesReady = useParityPage(...)`.
- Home's existing `PageReadyOverlay` remains visible while `stylesReady === false`.
- Dashboard/public Home content is not rendered until all Home-specific parity stylesheets are ready.
- Added a React foundation regression assertion requiring the Home page to gate rendering on `stylesReady`.
- Prepared a fresh Hosting identity: React `0.4.280 / 2026.10.01.306`; public storefront `0.16.32 / 2026.10.01.021`.

Important files:
- `react-app/src/pages/HomePage.jsx`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `tools/react-foundation-contract.mjs`
- `README.md`
- `docs/NEXT_CHAT_HANDOFF.md`

Verification:
- Source inspection confirms Home now captures `stylesReady`.
- Home loading condition now includes `|| !stylesReady`.
- The existing `PageReadyOverlay` uses globally preloaded CSS, so the user sees the loading state rather than partially styled Home content during route transitions.
- Full local test/build/generated-artifact verification and Hosting deploy still need to run on the Mac.

Deploy state:
- Fix commit: `77296f7f` — `fix: gate home rendering on parity styles`.
- Branch: `feature/react-firebase-port`.
- No merge to `main`.
- No Firebase deployment performed by the assistant.

Remaining:
- Pull, test/build, commit generated assets if changed, push, deploy Hosting, then re-test Revenue Share -> Back -> Home on desktop and mobile.

---

## 2026-10-01 — Visible brand renamed from KINJAI / KJ to PENGUIN / PG

Request:
- Rename the public-facing product brand from `KINJAI` to `PENGUIN`.
- Rename the compact fallback mark from `KJ` to `PG`.
- Preserve all internal identifiers, Firebase project/repository names, Firestore schema/collections, FOD wallet/error codes, DOM/data identifiers, and other compatibility-sensitive names.

Change:
- React visible branding now uses `PENGUIN`; compact textual fallback marks use `PG`.
- Updated React entry title, Home/Login/Admin/Platform/Revenue Share/Waiting Queue and operational page branding, QR branding, loading contexts, store-name fallbacks, and Platform Branding image alt/fallback text.
- Updated the React parity translation dictionary and Waiting Queue translation bundle from KINJAI to PENGUIN across TH / EN / MY / LO / KM.
- Updated `normalizeVisibleBranding()` so legacy visible names are normalized at runtime:
  - Food Order/Delivery With QR -> PENGUIN
  - Food Order Delivery -> PENGUIN
  - FOOD ORDER QR -> PENGUIN QR
  - LUKKAJA -> PENGUIN
  - KINJAI -> PENGUIN
  - standalone FOD -> PG
  - standalone KJ -> PG
- Updated static Home / Delivery / Takeaway / Order / Queue branding and shared static CSS fallback mark.
- Updated all static translation bundles under `public/assets/js/*translations*.js` plus app-info, footer, Home session label, and Admin Delivery QR paper branding.
- Kept tenant-facing Delivery Hero behavior intact: it still shows the store/tenant name rather than the platform brand.
- Updated branding regression tests and generated-build verification for PENGUIN.
- Updated README and current handoff branding checkpoint.
- Prepared a fresh Hosting identity: React `0.4.280 / 2026.10.01.307`; public storefront `0.16.32 / 2026.10.01.022`.

Important files:
- `react-app/index.html`
- `react-app/src/i18n/I18nProvider.jsx`
- `react-app/src/i18n/parity-translations.json`
- `react-app/src/config/release.js`
- `react-app/src/components/PlatformBrandingRuntime.jsx`
- `react-app/src/pages/HomePage.jsx`
- React Admin / Platform / Receipt / Revenue Share / Waiting Queue pages
- `react-app/public/parity/css/app.css`
- `public/index.html`
- `public/delivery/index.html`
- `public/takeaway/index.html`
- `public/order/index.html`
- `public/queue/index.html`
- `public/assets/css/app.css`
- `public/assets/js/app-info.js`
- `public/assets/js/*translations*.js`
- `tools/react-foundation-contract.mjs`
- `tools/generated-react-build-contract.mjs`
- `README.md`
- `docs/NEXT_CHAT_HANDOFF.md`

Verification:
- Active-branch source spot audit confirms current static Home / Delivery / Takeaway / Order / Queue entrypoints no longer contain visible KINJAI / KJ text.
- React parity translations contain 0 KINJAI and 0 standalone KJ occurrences; PENGUIN / PG are present instead.
- Public Home, Public storefront, Platform, Cashier document, Waiting Queue, and other static translation bundles checked in this pass contain 0 KINJAI and 0 standalone KJ occurrences.
- The only intentional source references to KINJAI / KJ that remain are compatibility-normalization / regression-test strings and documentation explaining the previous brand.
- Full local test/build/generated-asset verification and Hosting deploy still need to run on the Mac.

Deploy state:
- Core branding commit: `490b592a` — `feat: rename core brand to PENGUIN`.
- React operational pages: `2deedd80`.
- React admin/workspace pages: `19508460`.
- Static storefront surfaces: `3247d092`.
- Static translation bundles: `0392ea73`, `ac2eacec`.
- Branding regression/docs: `2db744e9`.
- Branch: `feature/react-firebase-port`.
- No merge to `main`.
- No Firebase deployment performed by the assistant.

Remaining:
- Pull the branch, run operational/parity tests, build React, verify generated assets, commit/push generated files if changed, then deploy Hosting.
- After deploy, verify header fallback `PG`, visible product name `PENGUIN`, Login, Home, Platform, QR paper, Footer, TH / EN / MY / LO / KM, and customer storefront pages.
- If currently uploaded Logo / App Icon artwork itself contains FOD / KINJAI / KJ text, upload replacement PENGUIN / PG artwork through Platform Branding; code cannot rewrite text embedded inside an uploaded image.

---

## 2026-10-01 — PENGUIN residual branding audit and static fallback cleanup

Request:
- Continue the branding rollout from the latest GitHub state without resetting or discarding newer work.
- Audit residual visible FOD / LUKKAJA / Food Order Delivery / FOOD ORDER QR / KINJAI / KJ strings while preserving internal identifiers.

Repository finding:
- Current GitHub HEAD at the start of this continuation was `588d3b91 build: finalize PENGUIN branding rollout`.
- The current handoff explicitly makes `PENGUIN / PG` authoritative and marks `KINJAI / KJ` as legacy, so this pass preserved the newer PENGUIN direction instead of reverting it to the stale KINJAI handoff text.
- Desktop Commander MCP command execution was not available in this chat, so the audit and edits were performed on GitHub branch `feature/react-firebase-port` only.

Audit result:
- Listed React source pages contain no remaining visible FOD / LUKKAJA / KINJAI / KJ branding.
- `AdminPage.jsx` still contains intentional internal `FOD_WALLET_TOPUP_*` error identifiers; these were not changed.
- Static compatibility audit found legacy visible fallback text in Verify, Delivery Success, Privacy, and Terms.

Change:
- `public/verify/index.html`: fallback brand mark `KJ` -> `PG`.
- `public/delivery/success/index.html`: fallback brand mark `KJ` -> `PG`; receipt shop fallback `KINJAI` -> `PENGUIN`.
- `public/privacy/index.html` and `public/terms/index.html`: visible `KINJAI / KJ` -> `PENGUIN / PG`.
- Prepared a new Hosting candidate identity after the previous finalized bundle:
  - React: `0.4.280 / 2026.10.01.308`
  - Public storefront: `0.16.32 / 2026.10.01.023`
- Updated README and current handoff release identity accordingly.

Important files:
- `public/verify/index.html`
- `public/delivery/success/index.html`
- `public/privacy/index.html`
- `public/terms/index.html`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`
- `docs/NEXT_CHAT_HANDOFF.md`

Verification:
- GitHub source audit completed for the requested React pages and listed static/compatibility pages.
- No visible residual terms were found in the listed React source; only compatibility-sensitive internal FOD wallet codes remain.
- Full `npm run test:operational`, `npm run test:react-parity`, `npm run build:react`, generated-file review, and `git diff --check` still must run on the Mac after pulling because Desktop Commander is unavailable in this chat.

Deploy state:
- Code/release commit: `95ade704` — `fix: remove legacy branding fallbacks`.
- This WORKLOG update is documentation-only and follows the completed code change.
- No merge to `main`.
- No Firebase deploy performed in this pass.

Remaining:
- Pull `feature/react-firebase-port` on the Mac.
- Run operational/parity tests, React build, and `git diff --check`.
- Commit/push generated build files if the build changes them.
- Deploy Hosting target `foodapp` only.
- Visually verify App Icon/header branding, Login Logo, favicon/apple-touch-icon, PENGUIN/PG fallbacks, and TH / EN / MY / LO / KM.

---

## 2026-10-01 — React foundation release-contract repair

Symptom:
- `npm run test:operational` passed.
- `npm run test:react-parity` stopped in `test:react-foundation` with `React release identity must stay centralized across footer/developer surfaces`.

Root cause:
- The Hosting candidate Build was correctly bumped from `2026.10.01.307` to `2026.10.01.308`.
- `tools/react-foundation-contract.mjs` still hard-coded the old Build `2026.10.01.307`, so every legitimate Build bump would require changing the assertion or the test would fail.
- Footer and Developer Panel already consume `REACT_RELEASE`; the failure was the stale test literal, not a runtime release-identity split.

Change:
- Removed the hard-coded Build literal from the foundation contract.
- The contract now reads the Build from centralized `react-app/src/config/release.js`, validates the expected `YYYY.MM.DD.NNN` format, and verifies both Footer and Developer Panel consume `REACT_RELEASE.version` / `REACT_RELEASE.build`.
- Current candidate identity remains React `0.4.280 / 2026.10.01.308`; no additional Build bump was needed because no Hosting deployment occurred between the failed test and this repair.

Important file:
- `tools/react-foundation-contract.mjs`

Verification:
- Source-level inspection confirms the stale `.307` assertion was the exact failing condition reported by Node at line 170.
- Generated-build verification already reads the current Build dynamically from `react-app/src/config/release.js`.
- Full test/build rerun must be performed on the Mac after pulling this commit.

Deploy state:
- Fix commit: `77f6e66d` — `test: centralize React release build contract`.
- No merge to `main`.
- No Firebase deploy.

Remaining:
- Pull branch on the Mac and rerun `npm run test:operational`, `npm run test:react-parity`, `npm run build:react`, and `git diff --check`.
- If generated files change, commit/push them before Hosting-only deploy.

---

## 2026-10-01 — Release-contract regex escaping correction

Symptom:
- Post-write verification of the new dynamic Build-format assertion showed the regex was double-escaped in the repository source (`\\d` instead of `\d`) because the replacement text passed through the GitHub API string layer.

Change:
- Corrected the regex in `tools/react-foundation-contract.mjs` so it validates the actual Build format `YYYY.MM.DD.NNN`.

Verification:
- Repository source was re-read after the correction before asking for another Mac test run.

Deploy state:
- Fix commit: `3b59ef86` — `test: fix release build regex escaping`.
- No merge to `main`.
- No Firebase deploy.

---

## 2026-10-01 — PG header fallback enforcement and parity CSS cache bust

Symptom:
- Production/mobile Admin still displayed the old compact brand mark `KJ` after the PENGUIN rollout.
- The screenshot showed the old mark in the header even though `AdminPage.jsx` and shared `app.css` already used `PG`.

Root cause:
- `AdminPage` loads `admin-retail-pos-parity.css` after shared `app.css`.
- That later stylesheet still declared `.brand-mark::after { content: "KJ"; }`, overriding the shared `PG` fallback.
- `admin-sales-report-retail-pos-parity.css` contained the same stale override.
- Several React operational page headers also still carried hidden legacy `FO` fallback text in their `brand-mark` markup.
- Page-specific parity CSS was loaded with stable URLs and no release query, so browser cache could keep an older stylesheet across Hosting releases.

Change:
- Replaced stale `KJ` pseudo-element fallback with `PG` in Admin and Admin Sales Report parity CSS source/output copies.
- Updated the static compatibility copy `public/assets/css/admin-retail-pos-parity.css` to `PG`.
- Replaced legacy `FO` header fallback markup with `PG` in Admin QR, Admin Users, Cashier, Cashier Receipt, Cashier Table QR, Kitchen, and Quick Order.
- `useParityPage` now appends the centralized React Build to dynamic parity stylesheet URLs, so a new Hosting Build forces fresh CSS instead of reusing an old cached parity stylesheet.
- Added foundation-contract coverage so the Admin parity CSS cannot reintroduce `KJ`, the listed operational headers cannot reintroduce `FO`, and parity CSS cache busting must remain tied to `REACT_RELEASE.build`.
- Prepared fresh Hosting identity:
  - React `0.4.280 / 2026.10.01.309`
  - Public storefront `0.16.32 / 2026.10.01.024`

Important files:
- `react-app/public/parity/css/admin-retail-pos-parity.css`
- `react-app/public/parity/css/admin-sales-report-retail-pos-parity.css`
- `public/react/parity/css/admin-retail-pos-parity.css`
- `public/react/parity/css/admin-sales-report-retail-pos-parity.css`
- `public/assets/css/admin-retail-pos-parity.css`
- `react-app/src/hooks/useParityPage.jsx`
- React Admin QR / Admin Users / Cashier / Cashier Receipt / Cashier Table QR / Kitchen / Quick Order pages
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`
- `docs/NEXT_CHAT_HANDOFF.md`

Verification:
- Repository inspection confirmed the screenshot path `/admin` loads `admin-retail-pos-parity.css` after `app.css`; the stale `KJ` declaration was therefore authoritative for the visible fallback mark.
- Source/output parity CSS targeted in this repair no longer contains `content: "KJ"`.
- The affected React operational header markup now uses `PG` instead of `FO`.
- Full npm test/build verification still needs to run on the Mac after pulling because Desktop Commander command execution is unavailable in this chat.

Deploy state:
- Fix commit: `a539bf0d` — `fix: enforce PG header branding fallbacks`.
- No merge to `main`.
- No Firebase deploy performed by the assistant.

Remaining:
- Pull the branch on the Mac.
- Run operational/parity tests, React build, and `git diff --check`.
- Commit/push generated build output if changed.
- Deploy Hosting target `foodapp` only.
- Hard refresh and re-check Admin, Sales Report, Admin Users, Cashier, Receipt, Table QR, Kitchen, Quick Order, and other headers for `PG`.
- If a header still shows literal `KJ` after this CSS repair and hard refresh, inspect whether the uploaded Platform App Icon image itself contains `KJ`; uploaded images intentionally override the text fallback.

---

## 2026-10-01 — Admin QR Back button icon and left alignment

Symptom / request:
- On `/admin/qr`, the Back button was displayed in the right-side header action group next to language/profile.
- User requested a left-arrow icon and left alignment.

Root cause:
- `AdminQrPage.jsx` rendered the Back link inside the generic `.app-header-actions` group, so it naturally stayed on the right.
- Unlike Admin Users, Admin QR had no dedicated leading header group for Brand + Back.

Change:
- Added `.admin-qr-header-leading` and moved the Back link beside the Admin QR brand on the left.
- Added Bootstrap icon `bi-arrow-left` and a separate label span.
- Kept Locale Switcher and User Menu in the right-side `.admin-qr-header-actions` group.
- Added responsive Admin QR header CSS following the established Admin Users header pattern.
- Added a React foundation regression assertion requiring the icon-led Back action to remain before the right-side actions.
- Prepared a fresh Hosting identity for this deployment:
  - React `0.4.280 / 2026.10.01.310`
  - Public storefront `0.16.32 / 2026.10.01.025`

Important files:
- `react-app/src/pages/AdminQrPage.jsx`
- `react-app/public/parity/css/menu-qr.css`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`
- `docs/NEXT_CHAT_HANDOFF.md`
- Generated React Hosting entrypoints and bundle.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS, including React foundation, migration, parity matrix, P0 actions, callable, tenant access, and UI layer contracts.
- Initial build attempt failed because this Mac checkout's `node_modules` contained only `.cache` and no Vite binary.
- Ran `npm install --include=dev`; dependency installation completed without a tracked package-lock change.
- `npm run build:react` PASS.
- Generated build contract PASS for Build `2026.10.01.310` and bundle `/react/assets/index-1sdlQ35c.js`.
- `git diff --check` PASS.

Deploy state:
- Commit: `9512b5ee` — `fix: align Admin QR back action`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to project `chat-45754` with React Build `2026.10.01.310`.
- Hosting emitted the known warning that rewrite function `lalamoveWebhook` has no valid endpoint; no Functions deployment was performed.
- No merge to `main`.
- Firebase scope for this change was Hosting only.

---

## 2026-10-01 — Admin QR Back icon vertical centering

Symptom / request:
- After moving the `/admin/qr` Back button to the left and adding `bi-arrow-left`, the arrow glyph still looked slightly off-center on the Y axis.

Root cause:
- Shared `.app-icon` intentionally uses inline-icon baseline alignment (`vertical-align: -.18em`), and Bootstrap Icon glyphs are emitted through `::before`.
- The Back button container was already flex-centered, but the glyph itself still inherited inline/baseline behavior inside its fixed icon box.

Change:
- Scoped the correction to `.admin-qr-header-back .app-icon` only.
- The icon now uses an explicit `1.25em × 1.25em` box, `inline-grid`, `place-items: center`, `align-self: center`, and `vertical-align: middle`.
- The icon `::before` is forced to a block with `line-height: 1`, keeping the Bootstrap glyph centered inside the icon box.
- No global icon rule was changed, so other page/button icon alignment is unaffected.
- Extended the React foundation contract to guard the vertical-centering CSS.
- Prepared fresh Hosting identity:
  - React `0.4.280 / 2026.10.01.311`
  - Public storefront `0.16.32 / 2026.10.01.026`

Important files:
- `react-app/public/parity/css/menu-qr.css`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`
- `docs/NEXT_CHAT_HANDOFF.md`
- Generated React Hosting entrypoints/bundle.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.01.311` and bundle `/react/assets/index-diPa2Spe.js`.
- `git diff --check` PASS.

Deploy state:
- Commit: `784232b9` — `fix: center Admin QR back icon`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to project `chat-45754` with React Build `2026.10.01.311`.
- Hosting emitted the known warning that rewrite function `lalamoveWebhook` has no valid endpoint; no Functions deployment was performed.
- No merge to `main`.
- Firebase scope was Hosting only.

---

## 2026-10-01 — PENGUIN Firebase Hosting origin cutover

Request:
- Change the primary Firebase Hosting URL from `https://natchanon-food-order-delivery.web.app` to `https://penguin-food.web.app` while keeping the existing Firebase project/data and without merging to `main`.

Firebase / Hosting migration:
- Created Firebase Hosting site `penguin-food` inside existing project `chat-45754`.
- Cleared and re-applied Hosting target `foodapp` so it points only to `penguin-food`.
- Kept legacy site `natchanon-food-order-delivery` in the project but removed it from the active deploy target; existing printed/legacy links remain available during transition.
- Added `penguin-food.web.app` to Firebase Authentication Authorized Domains while preserving the previous domain and default Firebase domains.

Application origin changes:
- React Firebase client `authDomain` -> `penguin-food.web.app`.
- Static Firebase config `authDomain` -> `penguin-food.web.app`.
- Firebase Messaging service worker `authDomain` -> `penguin-food.web.app`.
- Public trial signup now uses centralized `PUBLIC_APP_ORIGIN = https://penguin-food.web.app` for generated tenant preview links.
- Migrated the one existing `publicTenantSignups` document whose `previewUrl` still used the old Hosting origin.

External-integration audit:
- Platform Google Customer Login is currently disabled and has no OAuth Web Client ID stored, so there is no Google OAuth Authorized JavaScript Origin to migrate in this state.
- Platform Lalamove is configured and connection-verified in Sandbox. Webhook re-registration is intentionally performed only after the new Hosting site is live.
- No Firebase project ID, Firestore collection, Storage bucket, Functions region, schema, or internal identifier was renamed.

Regression protection:
- React foundation contract now requires `.firebaserc` target `foodapp` to resolve to `penguin-food`.
- Contract requires React/static/messaging Firebase configs to use the new auth domain and prevents the old Hosting domain from reappearing in those sources.
- Contract requires public signup links to use the new canonical origin.

Release:
- React `0.4.280 / 2026.10.01.312`
- Public storefront `0.16.32 / 2026.10.01.027`

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for `2026.10.01.312` and `/react/assets/index-BuQZRrDh.js`.
- `git diff --check` PASS.
- Source audit found no remaining old Hosting origin in active source outside historical docs/dead generated bundles.

Deploy state:
- Main cutover commit: `23eda796` — `feat: cut over to PENGUIN hosting origin`.
- Pushed to `origin/feature/react-firebase-port`.
- Deployed `requestTrialTenantSignup` successfully to `asia-southeast1` so new trial preview URLs use the PENGUIN origin.
- Deployed Hosting target `foodapp` successfully to `https://penguin-food.web.app` with React Build `2026.10.01.312`.
- Verified `https://penguin-food.web.app/` and `/admin` return HTTP 200; legacy Hosting remains reachable separately.
- Final Auth Authorized Domains include both old and new Hosting domains for transition safety.
- No merge to `main`.

---

## 2026-10-01 — Lalamove webhook export repair during PENGUIN origin cutover

Finding:
- After the new `penguin-food` Hosting release, Firebase still warned that rewrite function `lalamoveWebhook` had no valid endpoint.
- Lalamove Sandbox webhook registration returned HTTP 422 with `ERR_INVALID_RESPONSE` because the callback URL did not return a valid 200 response.

Root cause:
- `functions/lalamove-webhook.js` already contained the complete HTTP webhook implementation.
- `functions/index.js` never exported `lalamoveWebhook`, so Firebase Functions had no deployed function for the Hosting rewrite.

Change:
- Exported `lalamoveWebhook` from `functions/index.js`.
- Added React foundation regression coverage requiring the webhook export to remain present.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `git diff --check` PASS.
- Hosting Build remains `2026.10.01.312`; no additional Hosting deploy is required for this function-only repair.

Deploy state:
- Repair commit: `a30e2d88` — `fix: export Lalamove webhook`.
- Pushed to `origin/feature/react-firebase-port`.
- Deployed `lalamoveWebhook` successfully as a Node.js 22 2nd Gen Function in `asia-southeast1`.
- Verified `POST https://penguin-food.web.app/api/lalamove/webhook` returns HTTP 200 with `{"ok":true}` for an empty validation request.
- Re-registered the Lalamove Sandbox webhook successfully; Lalamove now reports `https://penguin-food.web.app/api/lalamove/webhook` as the registered URL.
- No additional Hosting deploy was required after the function export repair, so Build `2026.10.01.312` was not reused for another Hosting deployment.
- No merge to `main`.

---

## 2026-10-02 — Move Cashier walk-in order action into Hero

Request:
- Move the Cashier `รับออเดอร์หน้าร้าน` / walk-in Quick Order action out of the takeaway tools bar and into the Cashier Hero card.

Change:
- Moved the `/cashier/quick-order` action into a new `.cashier-hero-actions` area inside the Hero.
- Desktop Hero now keeps title/description on the left and the walk-in action on the right.
- Mobile Hero stacks the action below the Hero copy and keeps the full text label visible.
- Removed the walk-in action from `.cashier-actions`, so the takeaway tools bar now contains only waiting queue, Take Away QR, open Take Away order, and copy link actions.
- Styled the Hero action as a high-contrast white CTA with the existing lightning icon.
- Added React foundation regression coverage requiring the walk-in action to stay inside the Hero and outside the takeaway action bar.

Release:
- React `0.4.280 / 2026.10.02.313`
- Public storefront `0.16.32 / 2026.10.02.028`

Important files:
- `react-app/src/pages/CashierPage.jsx`
- `react-app/public/parity/css/cashier-refresh.css`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- Generated React Hosting entrypoints and bundle.

Verification:
- First foundation test run exposed an ordering bug in the newly added test declaration; corrected the declaration order before proceeding.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.313` and bundle `/react/assets/index-BfhqKTuk.js`.
- `git diff --check` PASS.

Deploy state:
- Commit: `1ad38806` — `feat: move Cashier walk-in action into Hero`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.313`.
- No Functions / Rules / Storage deployment was performed for this UI change.
- No merge to `main`.

---

## 2026-10-02 — Quick Order menu card metadata hierarchy

Request:
- On `/cashier/quick-order`, show each menu card with a clearer hierarchy:
  - menu name bold,
  - category smaller and normal weight,
  - price bold inside a badge.

Change:
- Added explicit `.quick-menu-name`, `.quick-menu-category`, and `.quick-menu-price-badge` elements to Quick Order menu cards.
- Menu name now uses heavier weight and retains two-line clamping.
- Category now appears as a smaller, normal-weight secondary line with ellipsis protection.
- Price now renders as a bold pill badge with a white surface and green text for contrast over food images.
- Increased the lower image gradient overlay height slightly so name/category/price fit cleanly without obscuring the full image.
- Added React foundation regression coverage for all three metadata roles and their CSS treatment.

Release:
- React `0.4.280 / 2026.10.02.314`
- Public storefront `0.16.32 / 2026.10.02.029`

Important files:
- `react-app/src/pages/QuickOrderPage.jsx`
- `react-app/public/parity/css/quick-order.css`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- Generated React Hosting entrypoints and bundle.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.314` and bundle `/react/assets/index-xxhr_5Rz.js`.
- `git diff --check` PASS.

Deploy state:
- Commit: `11c5c5b2` — `feat: refine Quick Order menu cards`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.314`.
- Verified `/cashier/quick-order` returns HTTP 200 from the PENGUIN Hosting origin.
- No Functions / Rules / Storage deployment was performed for this UI change.
- No merge to `main`.

---

## 2026-10-02 — Staff login transient Firebase network recovery

Symptom:
- A normal tenant user could log in on the new PENGUIN Hosting origin, but a Super Admin attempt in Edge displayed the Thai network error mapped from `auth/network-request-failed`.
- The issue appeared after the Hosting-origin cutover to `penguin-food.web.app`.

Production diagnosis:
- `https://penguin-food.web.app/__/auth/iframe` and `/__/auth/handler` return HTTP 200.
- Identity Toolkit accepts requests from the PENGUIN origin; the Firebase Web API key is not rejecting the new referrer.
- An isolated Microsoft Edge production test with a deliberately invalid account reached Identity Toolkit normally and returned `auth/invalid-credential`.
- Firebase Authentication shows the affected Super Admin account is verified, enabled, and its `lastLoginAt` advanced during the failed UI attempt, proving the server accepted the password sign-in request.
- Firestore `users/{uid}` for that account is valid: `role=super_admin`, `active=true`.
- This narrows the observed failure to a transient browser-side Firebase Auth/transport response after the server had already accepted authentication, rather than bad credentials or a broken Super Admin profile.

Revenue-share state checked during diagnosis:
- The tenant matching the screenshot is `ร้านทดสอบ SaaS`, with daily revenue share enabled at 3%.
- A temporary unlock override for period `2026-10-01` was already recorded by the Super Admin UID at approximately 00:32 local time.
- Current tenant fields show `revenueShareSuspended=false`; no direct tenant-state mutation was performed by this diagnostic/fix pass.

Change:
- Added one bounded retry for transient Firebase Auth errors (`network-request-failed`, `unavailable`, `deadline-exceeded`).
- Before repeating password sign-in, the flow waits briefly and reuses `auth.currentUser` when Firebase already established the intended account session.
- Added the same one-time transient retry to the Firestore user/tenant profile reads performed during login.
- Invalid credentials, disabled accounts, tenant suspension/expiry, and other non-transient errors are not retried or bypassed.
- Added a React foundation regression contract for this recovery behavior.

Release:
- React `0.4.280 / 2026.10.02.315`
- Public storefront `0.16.32 / 2026.10.02.030`

Important files:
- `react-app/src/auth/authFlow.js`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- Generated React Hosting entrypoints and bundle.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.315` and bundle `/react/assets/index-n1S5kih7.js`.
- `git diff --check` PASS.

Deploy state:
- Commit: `205bfcff` — `fix: retry transient staff login failures`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.315`.
- Production Microsoft Edge headless simulation deliberately aborted the first Identity Toolkit password request; the login flow issued exactly 2 sign-in requests and recovered to the normal invalid-credential message on the second request, proving the bounded retry works.
- No Functions / Rules / Storage deployment was performed for this login fix.
- No merge to `main`.

---

## 2026-10-02 — Admin Users mobile layout redesign

Request:
- Rework `/admin/users` on Mobile because the top action bar wrapped to two lines, the Hero / Add Employee button placement felt unbalanced, and the desktop table CSS made staff records difficult or impossible to view/edit.

Implementation:
- Kept the Desktop Admin Users table behavior intact.
- Mobile header now stays on a single row:
  - Brand + Back remain in the left leading group.
  - Language + profile remain in the right action group.
  - Mobile-only spacing/font/padding adjustments prevent the generic responsive header layer from wrapping this page.
- Mobile Hero was redesigned:
  - tighter title/kicker typography,
  - balanced copy spacing,
  - `เพิ่มพนักงาน` moved to a full-width CTA at the bottom of the Hero,
  - improved button radius/shadow and touch height.
- Staff list on Mobile is no longer a horizontally squeezed table:
  - each user row becomes an editable card,
  - table header is hidden only on Mobile,
  - translated field labels are supplied through `data-label`,
  - Name, Email, Role, Scope, Active, and Save stay visible without horizontal scrolling,
  - inputs/selects use full available width,
  - active checkbox and Save action have touch-friendly sizing.
- Added explicit semantic classes to user row cells so responsive behavior does not rely on fragile `nth-child` layout.
- Added React foundation regression coverage for:
  - one-row Mobile header,
  - full-width Hero CTA,
  - editable Mobile user-card structure.

Laravel comparison:
- Read the available Laravel Admin Users view/CSS as a behavior/layout reference.
- The connected Laravel checkout was on `feature/for_dev`, not `main`; no Laravel files were modified.

Release:
- React `0.4.280 / 2026.10.02.316`
- Public storefront `0.16.32 / 2026.10.02.031`

Important files:
- `react-app/src/pages/AdminUsersPage.jsx`
- `react-app/public/parity/css/admin-users.css`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- Generated React Hosting entrypoints/parity CSS/bundle.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.316` and bundle `/react/assets/index-Bfyuf6uM.js`.
- `git diff --check` PASS.

Deploy state:
- Commit: `2944199e` — `fix: redesign Admin Users mobile layout`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.316`.
- No Functions / Rules / Storage deployment was performed for this UI change.
- No merge to `main`.

---

## 2026-10-02 — Admin Users mobile card cleanup refinement

Request:
- Refine the previous Mobile Admin Users redesign because the Back action still did not feel left-aligned enough and the editable employee cards remained visually busy.

Change:
- Header:
  - moved the Back link before the Brand in source order, making it the true leftmost header action,
  - preserved the one-row Mobile header and right-side language/profile group.
- Employee cards:
  - replaced the previous label/value row stack with a cleaner 2-column card grid,
  - Name spans the full card width,
  - Email sits directly under Name as compact muted secondary text,
  - Role and Business Scope share one aligned 2-column row,
  - Active state and Save action share the bottom row,
  - removed per-cell divider lines and reduced label size,
  - tightened input typography/padding while retaining touch-friendly 40–42px controls,
  - kept Desktop table layout unchanged.
- Strengthened the React foundation contract so Back must precede Brand and the Mobile card must retain the structured 2-column layout.

Laravel comparison:
- Existing Laravel Admin Users files were reviewed again as a reference only.
- The connected Laravel checkout remains on `feature/for_dev`, not the requested MASTER `main`; no Laravel files were changed.

Release:
- React `0.4.280 / 2026.10.02.317`
- Public storefront `0.16.32 / 2026.10.02.032`

Important files:
- `react-app/src/pages/AdminUsersPage.jsx`
- `react-app/public/parity/css/admin-users.css`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- Generated React Hosting entrypoints/parity CSS/bundle.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.317` and bundle `/react/assets/index-BVmjZh5h.js`.
- `git diff --check` PASS.

Deploy state:
- Commit: `f4b59853` — `fix: tidy Admin Users mobile cards`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.317`.
- No Functions / Rules / Storage deployment was performed for this UI refinement.
- No merge to `main`.

---

## 2026-10-02 — Admin Users dedicated Mobile card redesign

Request:
- Correct the header order to Logo first, Back second.
- Redesign the Mobile employee list again because continued CSS adaptation of the Desktop table still looked cluttered and inconsistent.

Root cause:
- The previous attempts reused the same HTML table for Desktop and Mobile and then transformed table rows/cells into cards via CSS.
- That approach retained table semantics, column rules, and legacy responsive interactions, making spacing and visual hierarchy fragile.
- The header also grouped Brand text with the logo, making the requested exact Logo → Back → page-title order difficult to guarantee.

Change:
- Header markup is now explicitly ordered:
  1. compact PENGUIN brand mark / uploaded App Icon,
  2. Back button,
  3. page title,
  4. language/profile actions on the right.
- Mobile employee management now uses a dedicated `.user-mobile-list` with real `article.staff-user-card` components.
- Desktop retains its original table in `.user-desktop-table`; Mobile hides it rather than restyling table rows.
- Each Mobile employee card has three clean visual zones:
  - identity header: avatar, editable employee name, compact email,
  - permissions row: Role + Business Scope in two equal columns,
  - footer: touch-friendly Active switch + Save button.
- Added a custom compact switch for Active state instead of the raw checkbox.
- Removed the previous Mobile table-card CSS entirely.
- Strengthened the React foundation contract so:
  - Logo must precede Back, Back must precede page title,
  - dedicated Mobile cards and separate Desktop table must remain present.

Laravel comparison:
- Existing Laravel Admin Users view/CSS remains a reference only.
- The connected Laravel checkout is currently on `feature/for_dev`, not the documented MASTER `main`; no Laravel files were changed.

Release:
- React `0.4.280 / 2026.10.02.318`
- Public storefront `0.16.32 / 2026.10.02.033`

Important files:
- `react-app/src/pages/AdminUsersPage.jsx`
- `react-app/public/parity/css/admin-users.css`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- Generated React Hosting entrypoints/parity CSS/bundle.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.318` and bundle `/react/assets/index-CW8vp8w1.js`.
- `git diff --check` PASS.

Deploy state:
- Commit: `6cfdf616` — `fix: rebuild Admin Users mobile cards`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.318`.
- No Functions / Rules / Storage deployment was performed for this UI redesign.
- No merge to `main`.

---

## 2026-10-02 — Admin Users exact header order and isolated Mobile switches

Request:
- Correct the Mobile Admin Users header to the exact order: Logo → page title `จัดการพนักงาน` → Back button.
- Vertically center the Back arrow icon.
- Center the employee avatar icon against the editable Name input row.
- Fix Mobile Active switch behavior so loaded active users render green and manually toggling one user does not cause switches to become visually white or affect other users.

Root cause:
- The prior header order was Logo → Back → title, which did not match the requested visual order.
- Shared `.app-icon` baseline alignment could still make the Back arrow appear slightly low/high inside the compact button.
- The employee avatar was aligned to the top of the identity block, i.e. against the Name label instead of the input row.
- The previous Mobile switch remained an `input[type=checkbox]`; shared checkbox/theme CSS could override its custom pseudo-element styling after interaction.

Change:
- Header source order is now explicitly Logo → title → Back → right-side language/profile actions.
- Scoped Back icon CSS uses a fixed inline-grid icon box, `place-items:center`, `vertical-align:middle`, and a normalized `::before` line-height.
- Mobile employee avatar receives a measured top offset so its center aligns with the Name input rather than the field label.
- Replaced the Mobile Active checkbox with a controlled `button role="switch"`.
- Each card derives `isActive` from its own `drafts[user.uid]` entry:
  - active/true = green track + white knob,
  - inactive/false = white track + gray knob,
  - click patches only that card's UID with `active: !isActive`.
- Desktop checkbox behavior remains unchanged.
- Strengthened React foundation coverage for exact header order, arrow centering, avatar alignment, controlled switch markup, green ON state, and per-user draft toggling.

Release:
- React `0.4.280 / 2026.10.02.319`
- Public storefront `0.16.32 / 2026.10.02.034`

Important files:
- `react-app/src/pages/AdminUsersPage.jsx`
- `react-app/public/parity/css/admin-users.css`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- Generated React Hosting entrypoints/parity CSS/bundle.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.319` and bundle `/react/assets/index-CLzLZayu.js`.
- `git diff --check` PASS.
- Regression contract verifies Logo < title < Back < account actions.
- Regression contract verifies Mobile switches are controlled by per-user `draft.active` and ON state remains green.

Deploy state:
- Commit: `cc432755` — `fix: correct Admin Users mobile header and switches`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.319`.
- No Functions / Rules / Storage deployment was performed for this UI fix.
- No merge to `main`.

---

## 2026-10-02 — Admin Users keep Back action in the left header cluster

Request:
- The Admin Users Mobile header was almost correct, but the Back button was still visually pushed toward the right.
- Desired order remains: Logo → `จัดการพนักงาน` → `กลับหน้าจัดการร้าน`, all grouped on the left; language/profile stay on the right.

Root cause:
- In the Mobile header CSS, `.admin-users-header-title` still used `flex: 1 1 auto`.
- The leading group also used `flex: 1 1 auto`, so the title consumed the remaining horizontal space and pushed the Back button toward the right edge of the left group.
- A lower Mobile rule also previously removed `margin-left:auto` from the right action group.

Change:
- Mobile `.admin-users-header-leading` now uses `flex: 0 1 auto`.
- Mobile `.admin-users-header-title` now uses `flex: 0 1 auto`, so it no longer expands between Logo and Back.
- Mobile right-side `.app-header-actions` is explicitly pinned right with `margin-left:auto !important`.
- Header source order remains Logo → page title → Back → language/profile.
- Existing vertical arrow centering and the corrected per-user Mobile switches are unchanged.
- Strengthened the React foundation contract to preserve the left-cluster/right-actions layout.

Release:
- React `0.4.280 / 2026.10.02.320`
- Public storefront `0.16.32 / 2026.10.02.035`

Important files:
- `react-app/public/parity/css/admin-users.css`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- Generated React Hosting entrypoints/parity CSS/bundle.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.320` and bundle `/react/assets/index-CtuikuOq.js`.
- `git diff --check` PASS.

Deploy state:
- Commit: `68c5db77` — `fix: keep Admin Users back action left`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.320`.
- No Functions / Rules / Storage deployment was performed for this header-only fix.
- No merge to `main`.

---

## 2026-10-02 — Delivery account logout becomes icon-only top-right action

Request:
- On the Delivery checkout account card, remove the visible Logout button treatment and text.
- Keep only a logout icon and move it flush toward the card's upper-right corner.

Implementation:
- Added explicit `delivery-account-card` semantics to the account/address card.
- Moved `#customerLogoutButton` out of the normal Google-login action row and made it a direct child of the account card.
- The logout control now contains only Bootstrap icon `bi-box-arrow-right`; no visible text is rendered.
- Staff/customer runtime code now updates only accessible `aria-label` / `title` values and re-renders the icon; it no longer writes visible Logout text.
- Styled the control as an absolute 30×30 icon action at `top:10px; right:10px` with:
  - transparent background,
  - no border,
  - no button shadow,
  - vertically/horizontally centered icon.
- Added right padding to the account-card section title so the icon cannot overlap the heading.
- When a staff/customer session is active, the now-empty Google-login action row is removed from layout to avoid leftover vertical spacing.
- Updated both the active static Delivery CSS and the React parity copy so future Delivery React work preserves the same UI intent.
- Bumped Delivery CSS/JS cache-busting query strings so browsers receive the new static assets immediately.
- Added a React foundation regression contract requiring icon-only markup/runtime and top-right transparent positioning.

Laravel reference:
- The Laravel Delivery view was inspected before editing.
- The connected Laravel checkout is currently on `feature/for_dev`, not the documented MASTER `main`; no Laravel files were modified.

Release:
- React `0.4.280 / 2026.10.02.321`
- Public storefront `0.16.32 / 2026.10.02.036`

Important files:
- `public/delivery/index.html`
- `public/assets/css/delivery-addresses.css`
- `public/assets/js/delivery-addresses.js`
- `public/assets/js/customer-profile-service.js`
- `react-app/public/parity/css/delivery-addresses.css`
- `tools/react-foundation-contract.mjs`
- release metadata and generated Hosting bundle/entrypoints.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.321` and bundle `/react/assets/index-r8H7Y1KS.js`.
- `git diff --check` PASS.

Deploy state:
- Commit: `44a26027` — `fix: make Delivery logout icon-only`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.321`.
- Production Microsoft Edge Mobile viewport verification on `/s/saas-test-shop/delivery` confirmed:
  - visible Logout text is empty,
  - `bi-box-arrow-right` is present,
  - computed position is absolute,
  - computed background is transparent,
  - computed border is 0,
  - the action sits approximately 11px from the account card's top/right edges,
  - accessible `aria-label` remains available without visible button text.
- No Functions / Rules / Storage deployment was performed.
- No merge to `main`.

---

## 2026-10-02 — Diagnose missing Google login after Delivery logout

Symptom:
- After signing out from the Delivery account card, the page returned to Guest mode but no `เข้าสู่ระบบด้วย Google` button appeared.

Production diagnosis:
- Firebase Authentication Google provider is enabled.
- Firebase Google provider has a valid OAuth Web client configured.
- `penguin-food.web.app` is present in Firebase Auth Authorized Domains.
- Therefore the missing button is not caused by the new Hosting domain, Firebase Google provider, or the logout action itself.
- Firestore `platformSettings/googleCustomerLogin` currently contains:
  - `enabled = false`
  - empty `clientId`
- Delivery runtime `loadGoogleCustomerLoginSetting()` intentionally treats Google customer login as available only when both:
  - `enabled === true`
  - `clientId` is non-empty.
- After logout, `renderAccount()` correctly returns to Guest state, but `showGoogle` remains false because the Platform-level feature gate is disabled.

Conclusion:
- This is a Platform configuration mismatch, not a Delivery logout regression.
- Restoring the Google login button requires enabling the Platform Google Customer Login setting and supplying the configured Firebase Google OAuth Web client ID.
- No production configuration was changed during this diagnostic pass.

Deploy state:
- No source-code change.
- No Build bump.
- No Firebase deploy.
- No merge to `main`.

---

## 2026-10-02 — Isolate Delivery customer Google auth from staff auth

Requirement correction:
- Google login must belong only to Delivery customers.
- Customer Google identity/session must not be mixed with staff / Owner / Super Admin authentication or the employee-management flow.
- After customer logout, the Delivery page must return to Guest mode and show Google login again.

Root cause:
- The previous Delivery customer implementation reused the default Firebase Auth instance used by staff.
- Customer-vs-staff behavior was decided after sign-in by checking whether the authenticated UID had a `users/{uid}` staff profile.
- This coupled Delivery customer UI to staff auth state and allowed a staff session to hide Google customer login.
- Delivery also gated Google login through `platformSettings/googleCustomerLogin`, even though Firebase Authentication's Google provider is already enabled and the PENGUIN Hosting domain is authorized.

Architecture change:
- Added a dedicated named Firebase app for Delivery customers:
  - app name: `penguin-delivery-customer`
  - `customerAuth = getAuth(customerApp)`
  - `customerDb = getFirestore(customerApp)`
- The default Firebase app remains the staff / Owner / Super Admin session.
- Customer Google sign-in now calls `signInWithPopup(customerAuth, GoogleAuthProvider)` only.
- Customer logout now calls `signOut(customerAuth)` only.
- Customer profile and favorites read/write through `customerDb`, so Firestore rules authenticate against the customer app's Google user rather than the staff session.
- Customer profile data remains tenant-scoped under `tenants/{tenantId}/customerProfiles/{customerUid}`.
- Staff helper `getStaffSession()` remains available for explicitly staff-only code and uses `staffAuth/staffDb`; it is no longer part of the customer account flow.
- Delivery account UI no longer tracks `currentStaff`, `staffSignedIn`, or staff account labels.
- Guest Delivery state always offers Google login when no customer is signed in.
- Customer logout returns immediately to Guest UI and re-shows Google login.
- `delivery-staff-guard.js` is retained only as a no-op compatibility module so a stale/legacy module graph cannot hide customer Google login because a staff session exists.
- Delivery no longer reads `platformSettings/googleCustomerLogin` as a runtime feature gate. The existing Platform setting is now legacy configuration and does not control Delivery customer authentication.
- Google identity is explicitly validated from provider data (`providerId === "google.com"`); customer flow has no email/password login path.
- Admin employee management remains based on staff-only callable/user data, so customer Google accounts are not listed as employees.

Important separation note:
- Both named Firebase apps still use the existing Firebase project `chat-45754`. Therefore Google customer identities still exist in that project's Firebase Authentication provider directory.
- Application sessions, Firestore profile collections, staff UI, employee callables, and browser auth state are now separated.
- A completely separate Firebase Authentication directory would require a separate Identity Platform tenant or Firebase project and was not introduced in this migration.

Cache / compatibility:
- Bumped every active Delivery import of `customer-profile-service.js` to the same cache version.
- Bumped Delivery entrypoint cache versions for addresses, location-address resolver, and main Delivery runtime.
- Added React foundation regression coverage requiring:
  - named customer Firebase app,
  - separate `customerAuth/customerDb`,
  - Google-only popup login,
  - customer-only logout,
  - no Platform Google-login gate in customer runtime,
  - no staff state in Delivery account UI,
  - no-op legacy staff guard.

Release:
- React `0.4.280 / 2026.10.02.322`
- Public storefront `0.16.32 / 2026.10.02.037`

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.322` and bundle `/react/assets/index-BqVvgMY_.js`.
- `git diff --check` PASS.

Deploy state:
- Commit: `e20ac7f0` — `fix: isolate Delivery customer Google auth`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.322`.
- Production Microsoft Edge Mobile viewport verification on `/s/saas-test-shop/delivery` confirmed:
  - Guest state shows `เข้าสู่ระบบด้วย Google`,
  - Logout is hidden,
  - Customer account identity block is hidden,
  - Guest mode text is visible,
  - this works while Firestore `platformSettings/googleCustomerLogin.enabled` remains false, proving Delivery is no longer gated by that Platform setting.
- No Firestore Rules / Storage / Functions deployment was required for this split.
- No merge to `main`.

---

## 2026-10-02 — Delivery customer privilege isolation from staff identity

Requirement:
- A system user/staff account may use any email provider, including a Google account.
- A customer on a tenant Delivery storefront may authenticate only through Google.
- The same Google identity may be Owner/Staff of Tenant A while acting purely as a Customer of Tenant B.
- Delivery must never inherit/show staff roles or staff privileges from that identity.
- Delivery logout must affect only the customer session and must not sign out the staff/Owner/Admin session.

Why the previous named-app split was insufficient:
- Browser sessions were already separated with a named Firebase app, but both sessions still authenticated against the same Firebase Auth directory.
- A direct Google token from the customer named app could therefore have the same Firebase UID/email as an existing staff/Owner identity.
- Firestore/Storage staff rules that authorize by UID/email could still recognize that identity as staff even though the UI treated it as a customer.
- Identity Platform multi-tenancy was investigated as the strongest native directory split, but the current project is not upgraded to GCIP. The API rejected enabling tenants with `Tenant can only be enabled in GCIP`.
- No GCIP/billing-affecting project upgrade was performed.

Implemented architecture:
- Staff / Owner / Super Admin remain on Firebase app `[DEFAULT]`.
- Added customer data app `penguin-storefront-customer-v2`:
  - `customerAuth`,
  - `customerDb`,
  - `customerStorage`,
  - `customerFunctions`.
- Added separate Google verification broker app `penguin-google-customer-broker-v1`.
  - Google popup occurs only on the broker app.
  - The temporary Google token never becomes the authenticated token on the customer Firestore/Storage app.
- Added callable Function `createDeliveryCustomerSession`:
  - accepts only Firebase authentication whose `sign_in_provider` is `google.com`,
  - requires verified Google email,
  - derives a dedicated namespaced customer UID `cust_<sha256-prefix>`,
  - creates/maintains a Firebase Auth customer user without reusing the staff email identity,
  - sets persistent custom claims `customerContext=true`, `customerGoogle=true`, and `customerEmail`,
  - returns a custom token for the customer-only UID,
  - migrates an existing tenant-scoped customer profile from the legacy Google UID to the new customer UID when needed.
- Customer browser flow:
  1. Google popup on broker auth,
  2. call `createDeliveryCustomerSession`,
  3. sign broker out,
  4. sign customer data app in with the returned custom token,
  5. persist customer profile/favorites under `tenants/{tenantId}/customerProfiles/{cust_uid}`.
- Customer logout signs out only customer/broker apps; default staff auth is untouched.

Authorization isolation:
- Firestore Rules now define `customerContext()` requiring:
  - UID prefix `cust_`,
  - `customerContext=true`,
  - `customerGoogle=true`.
- Firestore staff `signedIn()` explicitly excludes `customerContext()`.
- Tenant owner/member/admin/cashier/kitchen/POS/waiting-queue staff helpers therefore cannot grant staff privileges to a customer-context token even when the Google email belongs to a tenant owner.
- Tenant/root `customerProfiles` are restricted to the customer's own customer-context UID.
- Storage Rules apply the same customer-context exclusion to every staff/admin role helper.
- Public payment-slip uploads remain governed by the existing image validation rule and do not require staff privileges.

Public storefront data isolation:
- Added `public-firebase-context.js` as the canonical public/customer Firebase context.
- Public tenant resolution uses `customerDb`, not the default staff Firestore instance.
- `data-service.js` selects `customerDb/customerStorage` for tenant public routes and retains default `db/storage` for staff routes.
- Delivery menu/settings/order/table data, Delivery/Takeaway/Order compatibility routes, Delivery success, payment-slip Storage, route/geocode Functions, customer profile, and favorites no longer use the default staff Firebase context on public tenant routes.
- Delivery UI contains no `currentStaff` / staff-role rendering path.
- Legacy `delivery-staff-guard.js` remains a no-op compatibility module.
- Customer Google login is not gated by the legacy `platformSettings/googleCustomerLogin` document.

Tenant behavior:
- One Google identity can have a staff role for Tenant A through the default staff context.
- The same person can explicitly Google-login as a Customer on Tenant B and receives the dedicated `cust_...` customer context.
- Customer profile/address/favorites remain independently tenant-scoped even though the customer UID is stable across tenants.
- Staff session survives customer login/logout because the sessions use separate Firebase app instances.

Cache / compatibility:
- Bumped the active public resolver, storefront service, customer profile service, Delivery map/address/runtime, Delivery success, Takeaway, Order compatibility imports so browsers cannot retain the previous mixed-auth module graph.
- Renamed the persistent customer named app to `penguin-storefront-customer-v2` so stale pre-isolation customer Auth persistence is not reused.

Regression protection:
- React foundation contract now requires:
  - separate customer data and Google broker Firebase apps,
  - broker-only Google popup,
  - custom-token exchange,
  - `cust_` namespace + customer claims,
  - Function export and Google-provider validation,
  - customer Firestore/Storage/public Functions contexts,
  - Firestore/Storage staff-role exclusion for customer-context tokens,
  - no staff state in Delivery account UI.

Release candidate:
- React `0.4.280 / 2026.10.02.323`
- Public storefront `0.16.32 / 2026.10.02.038`
- Generated React bundle `/react/assets/index-DiTVe5F5.js`.

Verification:
- `node --check functions/delivery-customer-auth.js` PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.323`.
- `git diff --check` PASS.
- Firebase dry run for `firestore:rules,storage,functions:createDeliveryCustomerSession` PASS.
- Firestore Rules compiled successfully in Firebase CLI dry run.
- Storage Rules compiled successfully in Firebase CLI dry run.
- Function source analysis/package validation completed successfully in Firebase CLI dry run.
- Existing firebase-functions version warning remains unchanged and was not upgraded during this targeted change.

Deploy state:
- User explicitly authorized the full production rollout.
- Deployed `functions:createDeliveryCustomerSession` successfully to `asia-southeast1`.
- Deployed Firestore Rules successfully; Firebase CLI compiled and released `firestore.rules`.
- Deployed Storage Rules successfully; Firebase CLI compiled and released `storage.rules`.
- Deployed Firebase Hosting target `foodapp` successfully to `https://penguin-food.web.app`.
- Production release is React `0.4.280 / 2026.10.02.323`; public storefront `0.16.32 / 2026.10.02.038`.
- Production callable negative-contract check:
  - unauthenticated POST to `createDeliveryCustomerSession` returns HTTP 401,
  - callable returns `UNAUTHENTICATED` with `Delivery customer sign-in requires Google authentication`.
- Production Microsoft Edge Mobile viewport verification on `/s/saas-test-shop/delivery` confirmed:
  - HTTP 200,
  - Google login is visible with label `เข้าสู่ระบบด้วย Google`,
  - Delivery logout is hidden in Guest state,
  - customer identity block is hidden in Guest state,
  - public menus load successfully (37 rendered cards in the test tenant),
  - loaded Delivery runtime is cache-busted at `delivery.js?v=20261002-006`,
  - Firebase app registry contains `[DEFAULT]`, `penguin-storefront-customer-v2`, and `penguin-google-customer-broker-v1`,
  - all three app Auth instances are signed out in a fresh Guest browser,
  - follow-up response audit observed no HTTP responses >= 400.
- Headless geolocation denial is expected in the production browser test and is unrelated to customer authentication.
- A fully authenticated Google popup exchange is intentionally not automated because it requires an actual user Google session; the deployed callable enforces Google provider server-side and the browser/rules contracts cover the remaining isolation path.
- Implementation commit: `3125a295` — `fix: isolate Delivery customer privileges`.
- No merge to `main`.

---

## 2026-10-02 — Sales Report Mobile KPI card redesign and Back alignment

Request:
- Redesign the Sales Report summary cards because the current Mobile cards looked visually stacked/overlapping.
- Move the Back action into the left header cluster.
- Vertically center the Back arrow icon.

Root cause:
- The four Sales Report KPI cards still used the shared `.summary-card` class while multiple Sales Report/theme styles also decorated that class.
- The old KPI markup used a second `.summary-icon` absolutely positioned inside each card, which competed with the title/value area on narrow screens and compounded the layered-card appearance.
- Mobile `.super-admin-header-leading` remained `flex: 1 1 auto`; the leading group expanded across the header and visually pushed the Back action toward the right instead of keeping it next to the title.

Change:
- Replaced the four KPI summary cards with a dedicated Sales Report component structure:
  - `.sales-kpi-grid`
  - `.sales-kpi-card`
  - `.sales-kpi-card__head`
  - `.sales-kpi-card__icon`
  - `.sales-kpi-card__label`
  - `.sales-kpi-card__metric`
- Removed the old absolute decorative `.summary-icon` markup from these four KPI cards.
- New cards use:
  - one clean top accent line,
  - one inline icon block in the title row,
  - value/unit grouped in a separate lower metric block,
  - uniform height/padding,
  - clipped overflow,
  - lighter border/shadow instead of layered shadows.
- Desktop keeps 4 KPI cards per row.
- Mobile keeps 2 KPI cards per row with tighter spacing, smaller icon/label/value sizing, and independent card boundaries.
- Added scoped accent variants for Net Sales, Receipt Count, Average Receipt, and Sold Items without changing report calculations.
- Header now uses explicit Sales Report classes:
  - `.sales-report-header-leading`
  - `.sales-report-header-brand`
- The Sales Report header leading group uses `flex: 0 1 auto`, preventing it from consuming the entire row and keeping Logo/title/Back together on the left.
- Language/Profile actions remain pinned right.
- Back arrow receives a fixed inline-grid icon box with `place-items:center`, normalized line-height, and `vertical-align:middle` so it is centered on the Y axis.
- Filter/report logic and data calculations were not changed.

Laravel comparison:
- Connected Laravel reference checkout remains on `feature/for_dev`, not documented MASTER `main`.
- No Laravel files were changed.

Regression protection:
- React foundation contract now requires:
  - Sales Report left-cluster header classes,
  - vertically centered Back arrow,
  - dedicated KPI component markup,
  - no regression to the old primary `.summary-card` markup,
  - 4-column desktop KPI layout,
  - 2-column Mobile KPI layout,
  - clipped KPI overflow and tabular numeric values.

Release:
- React `0.4.280 / 2026.10.02.324`
- Public storefront `0.16.32 / 2026.10.02.039`
- Generated React bundle `/react/assets/index-DZ6k_9XI.js`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React foundation contract PASS.
- React migration/parity matrix/P0 action/callable/tenant-access/UI-layer contracts PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.324`.
- `git diff --check` PASS.

Deploy state:
- Implementation commit: `4f2add56` — `fix: redesign Sales Report mobile cards`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.324`.
- No Functions / Firestore Rules / Storage Rules deployment was performed for this UI-only change.
- Production verification:
  - `/admin/sales-report` returns HTTP 200,
  - production `sales-report-modern.css?v=2026.10.02.324` contains the dedicated `.sales-kpi-card` system,
  - production CSS contains the Mobile 2-column KPI rule,
  - production CSS contains the Sales Report left-cluster header rule,
  - production CSS contains the centered Back-arrow `place-items:center` rule.
- No merge to `main`.

---

## 2026-10-02 — Admin dashboard Sales Report spotlight card redesign

Request clarification:
- The card that still looked unchanged was the `รายงานยอดขาย` navigation card on `/admin`, not the KPI cards inside `/admin/sales-report`.
- User supplied a focused screenshot showing the dashboard card still using the same layered visual treatment.

Root cause:
- The Admin dashboard Sales Report entry still used `card admin-vr-card`.
- Generic `.admin-vr-card` styling adds:
  - a colored left pseudo-element,
  - a large translucent circular `::after` decoration at the top-right,
  - tinted gradient background,
  - shared hover/shadow treatment.
- The prior task redesigned the report page KPI cards only, so this dashboard navigation card correctly remained visually unchanged.

Change:
- Replaced the Sales Report dashboard entry with a dedicated standalone component:
  - `.admin-sales-report-spotlight`
  - `.admin-sales-report-spotlight__icon`
  - `.admin-sales-report-spotlight__content`
  - `.admin-sales-report-spotlight__action`
- Removed `card admin-vr-card`, `data-admin-vr-accent`, generic section-title markup, and generic `admin-heading-icon` from this report card only.
- The new spotlight card is a single clean white surface with:
  - a narrow green leading accent,
  - one compact chart icon tile,
  - title + description as one text group,
  - a dedicated green Report action.
- Explicitly disables the previous circular `::after` decoration.
- Desktop layout uses icon / content / action columns.
- Mobile layout uses a compact 42px icon, responsive content column, and compact action; the extra trailing arrow is hidden on Mobile to avoid crowding.
- Existing navigation destination remains `/admin/sales-report`.
- Other Admin dashboard cards remain unchanged.

Laravel comparison:
- Connected Laravel reference checkout remains on `feature/for_dev`, not documented MASTER `main`.
- No Laravel files were changed.

Regression protection:
- React foundation contract now requires the dedicated Sales Report spotlight markup/CSS.
- Contract explicitly rejects regression to the old `card admin-vr-card` Sales Report markup.
- Contract requires both Desktop and Mobile spotlight grid structures and disabled circular decoration.

Release:
- React `0.4.280 / 2026.10.02.325`
- Public storefront `0.16.32 / 2026.10.02.040`
- Generated React bundle `/react/assets/index-CL9NdkjE.js`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React foundation contract PASS.
- React migration/parity matrix/P0 action/callable/tenant-access/UI-layer contracts PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.325`.
- `git diff --check` PASS.

Deploy state:
- Implementation commit: `7b1b4d9e` — `fix: redesign Admin sales report card`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.325`.
- No Functions / Firestore Rules / Storage Rules deployment was performed for this UI-only change.
- Production verification:
  - `/admin` returns HTTP 200,
  - production `admin-react-master-visual.css` contains `.admin-sales-report-spotlight`,
  - Desktop spotlight grid `50px minmax(0,1fr) auto` is present,
  - Mobile spotlight grid `42px minmax(0,1fr) auto` is present,
  - old circular decoration is explicitly disabled with `content:none`,
  - production bundle `/react/assets/index-CL9NdkjE.js` contains the new spotlight markup and action class.
- No merge to `main`.

---

## 2026-10-02 — Sales Report receipt table horizontal scrolling repair

Symptom:
- On Mobile / Chrome Responsive, the `รายการแยกตามใบเสร็จ` table visibly overflowed horizontally and showed a scrollbar, but the user could not drag/scroll left-right through the remaining receipt columns.

Root cause:
- The React Sales Report markup retained `data-horizontal-scroll="true"`, but the migrated React route does not load the legacy `horizontal-scroll-restore.js` runtime that used to enhance those elements with wheel and mouse-drag behavior.
- Base CSS provided only `overflow:auto`; it did not explicitly restore touch momentum, horizontal overscroll containment, or the old drag affordance on this React table.
- This is especially visible in Chrome Responsive testing: the table can be wider than its viewport and display a scrollbar, while click-dragging the table content itself does not natively move `scrollLeft`.

Change:
- Added a React `useHorizontalScroller(ref)` behavior directly to `AdminSalesReportPage`.
- The receipt table wrapper now has:
  - `receiptScrollRef`,
  - semantic class `.receipt-table-scroll`,
  - existing `data-horizontal-scroll="true"` retained.
- Horizontal interaction now supports:
  - native touch swipe,
  - trackpad horizontal delta,
  - mouse wheel mapped to horizontal movement while horizontal overflow exists,
  - left-button mouse drag across table cells,
  - pointer capture so drag remains stable while the cursor moves,
  - click suppression only after a real drag so row action links/buttons are not accidentally triggered.
- Drag start deliberately ignores `button`, `a`, `input`, `select`, `textarea`, and role-button targets so receipt View/Print controls remain clickable.
- Added explicit table-scroll CSS:
  - `overflow-x:auto !important`,
  - `overflow-y:hidden !important`,
  - `-webkit-overflow-scrolling:touch`,
  - `overscroll-behavior-x:contain`,
  - `touch-action:pan-x pan-y`,
  - visible thin scrollbar,
  - grab/grabbing cursor for desktop testing.
- Receipt table now uses `width:max-content` with existing `min-width:980px`, guaranteeing real horizontal overflow on narrow viewports instead of collapsing columns into the card width.
- No receipt data, filtering, pagination, or report calculations were changed.

Regression protection:
- React foundation contract now requires:
  - `useHorizontalScroller`,
  - receipt scroll ref/class,
  - non-passive wheel and pointer-move listeners,
  - pointer capture,
  - touch momentum/overscroll/touch-action CSS,
  - grab state,
  - max-content + 980px receipt table width.

Release:
- React `0.4.280 / 2026.10.02.326`
- Public storefront `0.16.32 / 2026.10.02.041`
- Generated React bundle `/react/assets/index-BUguVrxt.js`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React foundation contract PASS.
- React migration/parity matrix/P0 action/callable/tenant-access/UI-layer contracts PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.326`.
- `git diff --check` PASS.

Deploy state:
- Implementation commit: `bacf59d3` — `fix: restore Sales Report horizontal scroll`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.326`.
- No Functions / Firestore Rules / Storage Rules deployment was performed for this UI-only interaction repair.
- Production verification:
  - `/admin/sales-report` returns HTTP 200,
  - production `sales-report-modern.css` contains `overflow-x:auto !important`,
  - touch momentum and `touch-action:pan-x pan-y` are present,
  - grab/grabbing interaction styling is present,
  - receipt table uses `width:max-content` and `min-width:980px`,
  - production bundle `/react/assets/index-BUguVrxt.js` contains `receipt-table-scroll`, `is-horizontal-dragging`, and `data-horizontal-scroll`.
- No merge to `main`.

---

## 2026-10-02 — Sales Report touch drag unlock for Chrome Responsive

Symptom:
- After the first horizontal-scroll repair, the receipt table still felt locked in Chrome DevTools Responsive mode even though the scrollbar and overflow were present.

Root cause:
- The first React drag handler deliberately accepted only `pointerType === "mouse"`.
- Chrome DevTools Responsive commonly emulates pointer input as `touch`, so drag gestures generated from the desktop mouse were not entering the custom horizontal drag path.
- CSS still allowed browser handling on both axes via `touch-action: pan-x pan-y`, so the app did not own the horizontal gesture in touch-emulation mode.

Change:
- Expanded the Sales Report receipt-table drag handler to support mouse, touch, and pen pointer events.
- Mouse retains immediate horizontal drag behavior.
- Touch/pen now use axis intent detection:
  - wait until movement exceeds a small threshold,
  - if vertical movement dominates, leave the gesture to normal page scrolling,
  - if horizontal movement dominates, switch to table drag, capture the pointer, and update `scrollLeft`.
- Added `startY` and `dragAxis` tracking so horizontal table drag does not block vertical page scrolling.
- Removed the mouse-only early-return gate.
- Changed receipt scroll CSS from `touch-action: pan-x pan-y` to `touch-action: pan-y`.
  - Browser keeps native vertical scrolling.
  - Horizontal gesture is reserved for the custom receipt-table scroller.
- View/Print buttons and other interactive controls remain excluded from drag start.

Regression protection:
- React foundation contract now requires:
  - touch/pen axis detection,
  - `diffY` comparison,
  - absence of the old mouse-only gate,
  - pointer capture,
  - `touch-action: pan-y`.

Release:
- React `0.4.280 / 2026.10.02.327`
- Public storefront `0.16.32 / 2026.10.02.042`
- Generated React bundle `/react/assets/index-BTd5KA2I.js`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React foundation contract PASS.
- React migration/parity matrix/P0 action/callable/tenant-access/UI-layer contracts PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.327`.
- `git diff --check` PASS.

Deploy state:
- Commit/push/deploy are performed after this WORKLOG entry.
- Firebase scope is Hosting only.
- No Functions / Firestore Rules / Storage Rules changes are required.
- No merge to `main`.

---

## Entry template for future changes

### YYYY-MM-DD — Short title

Symptom / request:
- ...

Root cause:
- ...

Change:
- ...

Important files:
- `path/to/file`

Verification:
- ...

Deploy state:
- Not committed / pushed / merged / deployed.
- Or record the exact commit / branch / deployment if explicitly requested.

Remaining:
- None, or list exact follow-up.
