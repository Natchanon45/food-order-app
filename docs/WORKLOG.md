# Development Worklog

Updated: 2026-10-07

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
- Implementation commit: `187a0fe2` — `fix: unlock Sales Report touch drag`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.327`.
- No Functions / Firestore Rules / Storage Rules deployment was performed.
- Production verification:
  - `/admin/sales-report` returns HTTP 200,
  - production CSS contains `touch-action:pan-y`,
  - production CSS contains horizontal overflow and grabbing state,
  - production bundle is `/react/assets/index-BTd5KA2I.js`,
  - production bundle contains the receipt scroll class, pointer-type handling, Y-axis intent tracking, and pointer capture code.
- No merge to `main`.

---

## 2026-10-02 — Sales Report receipt table switched to native scrolling parity

User comparison:
- `ยอดขายแยกรายเดือน` can be dragged horizontally in the same Chrome Responsive device mode.
- `รายการแยกตามใบเสร็จ` cannot.
- Therefore the problem is local to the receipt-table scroll implementation, not DevTools touch emulation itself.

Root cause:
- The monthly chart relies on browser-native `overflow-x:auto` behavior.
- The receipt table had accumulated a custom pointer/wheel drag layer plus `touch-action:pan-y`.
- `touch-action:pan-y` explicitly removes horizontal panning from the browser and requires the JavaScript pointer handler to take over.
- If that handler does not receive/own the emulated gesture exactly as expected, horizontal movement is effectively locked.
- This diverged from the already-working monthly chart behavior.

Change:
- Removed `useHorizontalScroller()` completely from the Sales Report React page.
- Removed receipt scroll ref and all custom:
  - wheel interception,
  - pointerdown/pointermove handling,
  - pointer capture,
  - preventDefault drag logic,
  - click suppression.
- Receipt table now uses browser-native horizontal scrolling only, matching the monthly chart model.
- Removed `touch-action:pan-y`; default browser touch handling is restored.
- Kept native-friendly scroll properties:
  - `overflow-x:auto !important`,
  - `overflow-y:hidden !important`,
  - `-webkit-overflow-scrolling:touch`,
  - `overscroll-behavior-x:contain`.
- Aligned scrollbar styling with the monthly chart using the green thumb / transparent track.
- Receipt table still uses `width:max-content` and `min-width:980px` so narrow screens have real horizontal overflow.
- Added `contain:inline-size` to the receipt wrapper so the oversized table cannot expand the card instead of scrolling.

Regression protection:
- React foundation contract now requires native receipt scrolling and explicitly rejects:
  - `useHorizontalScroller`,
  - receipt scroll refs,
  - pointermove interception,
  - `touch-action:pan-y`.
- Contract preserves max-content / 980px table overflow and native momentum scrolling.

Release:
- React `0.4.280 / 2026.10.02.328`
- Public storefront `0.16.32 / 2026.10.02.043`
- Generated React bundle `/react/assets/index-DOhou3DW.js`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React foundation contract PASS.
- React migration/parity matrix/P0 action/callable/tenant-access/UI-layer contracts PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.328`.
- `git diff --check` PASS.

Deploy state:
- Implementation commit: `36d1a507` — `fix: align receipt table with native scroll`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.328`.
- No Functions / Firestore Rules / Storage Rules deployment was performed.
- Production verification:
  - `/admin/sales-report` returns HTTP 200,
  - production CSS contains native `overflow-x:auto`, momentum scrolling, and horizontal overscroll containment,
  - production CSS no longer contains `touch-action:pan-y`,
  - production CSS contains `contain:inline-size` on the receipt wrapper,
  - production bundle is `/react/assets/index-DOhou3DW.js`,
  - production bundle contains the receipt scroll wrapper,
  - production bundle no longer contains the custom `useHorizontalScroller` function or `receiptScrollRef`.
- No merge to `main`.

---

## 2026-10-02 — Sales Report receipt nested horizontal-scroll root-cause fix

Symptom:
- User repeatedly confirmed that `ยอดขายแยกรายเดือน` could be swiped horizontally in Chrome Responsive / iPhone emulation, while `รายการแยกตามใบเสร็จ` remained locked.
- Earlier custom-drag and native-wrapper changes did not solve the live Production interaction.

Root cause investigation:
- Used a read-only clone of the current Chrome Firebase Auth persistence to open the authenticated Production Sales Report in a separate headless Chrome instance.
- Reproduced the exact yearly 2026 / พ.ศ. 2569 state with 8 receipts.
- Production live computed state before the fix:
  - monthly chart: one scroll container, `display:flex`, `overflow-x:auto`;
  - receipt wrapper: `clientWidth=372`, `scrollWidth=980`, `overflow-x:auto`;
  - inner receipt `<table>`: unexpectedly `display:block`, `overflow-x:auto`, `clientWidth=scrollWidth=980`.
- The global `shared-responsive.css` Mobile safety rule changes all non-receipt-page tables to `display:block; width:100%; overflow-x:auto`.
- Therefore the receipt area had two nested horizontal scroll containers:
  1. `.receipt-table-scroll` outer wrapper (actually scrollable);
  2. inner `.receipt-table` (classified as a scroll container but with no own horizontal overflow).
- Touch hit-testing on real receipt rows landed on `<td>` inside the inner table. Browser panning bound to the nearest inner overflow container, which could not move, and did not transfer the horizontal gesture to the outer wrapper.
- Live Production touch simulation confirmed the bug:
  - before swipe: wrapper `scrollLeft=0`, table `scrollLeft=0`;
  - after swipe: wrapper `scrollLeft=0`, table `scrollLeft=0`.
- A temporary CSS override was injected into the same authenticated Production clone:
  - inner table `display:table !important`,
  - `overflow:visible !important`,
  - `max-width:none !important`,
  - `width:max-content !important`,
  - `min-width:980px !important`.
- The identical touch swipe then moved the outer wrapper to `scrollLeft=303` while inner table stayed at `0`, proving the root cause and fix.

Change:
- `sales-report-modern.css` now explicitly overrides the global Mobile table safety rule for the Sales Report receipt table:
  - `display: table !important`;
  - `width: max-content !important`;
  - `min-width: 980px !important`;
  - `max-width: none !important`;
  - `overflow: visible !important`.
- `.receipt-table-scroll` remains the only horizontal scroll container.
- No custom pointer/touch interception is reintroduced.
- Existing native momentum scrolling and scrollbar styling remain intact.

Regression protection:
- React foundation contract now requires:
  - dedicated direct-child receipt-table selector;
  - `display:table !important`;
  - max-content width / 980px minimum width;
  - `max-width:none !important`;
  - `overflow:visible !important`;
  - no custom pointer interception;
  - no `touch-action:pan-y` lock.
- This specifically protects against the global `shared-responsive.css` table rule becoming the inner horizontal scroller again.

Release:
- React `0.4.280 / 2026.10.02.329`
- Public storefront `0.16.32 / 2026.10.02.044`
- Generated React bundle `/react/assets/index-62pKsOHK.js`.

Verification:
- Authenticated Production clone reproduced 8 real receipt rows for yearly 2026 before source change.
- Temporary override on Production clone changed the same real touch gesture from `scrollLeft=0` to outer wrapper `scrollLeft=303`.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React foundation contract PASS.
- React migration/parity matrix/P0 action/callable/tenant-access/UI-layer contracts PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.329`.
- `git diff --check` PASS.

Deploy state:
- Implementation commit: `98d6f8f1` — `fix: remove receipt nested scroller`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` with React Build `2026.10.02.329`.
- No Functions / Firestore Rules / Storage Rules deployment was performed.
- Authenticated Production verification on yearly 2026 / พ.ศ. 2569 with 8 real receipts:
  - footer reports Build `2026.10.02.329`,
  - outer wrapper: `clientWidth=372`, `scrollWidth=980`,
  - inner table: `display=table`, `overflow-x=visible`, `max-width=none`,
  - identical touch swipe moved outer wrapper from `scrollLeft=0` to `scrollLeft=489`,
  - inner table remained `scrollLeft=0`.
- This confirms Production now has exactly one horizontal scroll owner and the previously locked receipt swipe is resolved in the live browser runtime.
- No merge to `main`.

---

## 2026-10-02 — Canonical Home Order/Delivery header, Waiting Queue removal, and queue-back grid repair

Request:
- Keep `Order / Delivery` on one line on Mobile.
- Allow `เมนูหลักของร้านอาหารสำหรับพนักงานและผู้ดูแลร้าน` to wrap to two lines.
- Remove `คิวรอโต๊ะ` from the main Home dashboard.
- Fix the Home menu grid becoming one card per row after pressing Back from Waiting Queue.

Root cause:
- Production has two Home implementations:
  1. canonical static Home at `/` from `public/index.html`,
  2. React `HomePage.jsx` that can be rendered inside the SPA when navigating client-side from a React route.
- Direct Home loads the static implementation and displayed the intended 2-column Mobile grid.
- Waiting Queue is a React route. Its Back action used React `<Link to="/">`, so pressing Back did not reload canonical static Home; it rendered React Home inside the existing SPA document instead.
- This explains why the user saw a different Home layout only after returning from Waiting Queue.
- The canonical static Home also contained a Waiting Queue card, and `waiting-queue-entry.js` could dynamically inject the same card again if missing.
- The Mobile Order/Delivery section header used fixed ratio columns `minmax(92px,.8fr) minmax(0,1.2fr)`, which made the title column too narrow and forced `Order / Delivery` onto two lines.

Change:
- Canonical static Home:
  - removed the Waiting Queue navigation card from `public/index.html`,
  - removed the `waiting-queue-entry.js` script from Home so it cannot dynamically re-add the queue card,
  - added `.dashboard-section-order-delivery` to scope the requested header layout,
  - cache-busted `/assets/css/home-dashboard.css` to `v=20261002-045`.
- React Home parity:
  - removed the `waiting_queue` `DashboardCard`,
  - added the same `.dashboard-section-order-delivery` class.
- Waiting Queue:
  - changed the Back control from React `<Link to="/">` to a normal `<a href="/">`,
  - this forces a full navigation to canonical static Home and prevents the alternate React Home from appearing after Back.
- Home dashboard CSS in both static and React parity copies:
  - scoped Mobile Order/Delivery header to `grid-template-columns:max-content minmax(0,1fr)`,
  - title uses `white-space:nowrap` and 16px Mobile size,
  - description remains normal wrapping with `max-width:210px` and balanced wrapping,
  - existing 2-column Mobile nav-card grid is preserved.
- Waiting Queue remains available from its direct route and other intentional navigation surfaces; only the main Home dashboard card was removed.

Measured Mobile layout verification at 430px:
- `Order / Delivery` title:
  - width ~139.48px,
  - height 20px,
  - line-height 20px,
  - `white-space:nowrap`,
  - therefore exactly one line.
- Description:
  - width 210px,
  - height ~28.34px,
  - line-height ~14.175px,
  - therefore two lines.
- Home nav grid:
  - `180px 180px`,
  - four test cards remained 180px each,
  - therefore two columns.

Laravel comparison:
- Connected Laravel reference checkout remains on `feature/for_dev`, not documented MASTER `main`.
- No Laravel files were changed.

Regression protection:
- React foundation contract now requires:
  - Waiting Queue absent from React Home main cards,
  - canonical static Home contains no Waiting Queue card or injector script,
  - Order/Delivery scoped header class in both Home implementations,
  - max-content Mobile title column,
  - nowrap title and two-line-capable description,
  - Waiting Queue Back uses `<a href="/">` and not React `<Link>`.

Release:
- React `0.4.280 / 2026.10.02.330`
- Public storefront `0.16.32 / 2026.10.02.045`
- Generated React bundle `/react/assets/index-iSFhZ0mq.js`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React foundation/migration/parity matrix/P0 action/callable/tenant-access/UI-layer contracts PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.330`.
- `git diff --check` PASS.
- Post-build audit confirms canonical `public/index.html` contains no Waiting Queue Home card/injector and Waiting Queue Back source is the full-navigation anchor.

Deploy state:
- Commit/push/deploy are performed after this WORKLOG entry.
- Firebase scope is Hosting only.
- No Functions / Firestore Rules / Storage Rules changes are required.
- No merge to `main`.

---

## 2026-10-02 — Canonical Home root cache invalidation

Follow-up symptom:
- The first Home layout/Waiting Queue fix was deployed with React Build `2026.10.02.330` / public Build `2026.10.02.045`.
- Direct server content was already correct, but an authenticated browser session could still display the previous Home including the Waiting Queue card and public Build `.044`.
- Returning from Waiting Queue could therefore still land on a visually stale Home despite the source/deploy being updated.

Root cause:
- Firebase Hosting returned the root document with `Cache-Control: max-age=3600`.
- `curl https://penguin-food.web.app/` showed the new Home markup, but the existing Chrome profile could legally reuse the prior root HTML for up to one hour.
- Operational React routes already had `no-cache, no-store`; canonical root Home did not.

Change:
- Added explicit Firebase Hosting headers for both `/` and `/index.html`:
  - `Cache-Control: no-cache, no-store, must-revalidate`.
- Waiting Queue Back now full-navigates to `/?from=waiting-queue` instead of plain `/`.
  - The query creates a fresh navigation/cache key even for a browser that still has an older cached root response.
- Canonical Home strips that one-time query immediately after the new document loads using `history.replaceState(null, "", "/")`, so the visible address remains clean.
- Home dashboard stylesheet cache key bumped to `home-dashboard.css?v=20261002-046`.
- Added regression coverage requiring:
  - root and index no-cache Hosting configuration,
  - fresh Waiting Queue Back URL,
  - canonical Home query cleanup.

Release:
- React `0.4.280 / 2026.10.02.331`
- Public storefront `0.16.32 / 2026.10.02.046`

Deploy state:
- Cache-fix implementation commit: `e5f5da54` — `fix: prevent stale canonical Home cache`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Root response now returns `Cache-Control: no-cache, no-store, must-revalidate`.
- Production root HTML references `home-dashboard.css?v=20261002-046` and contains the scoped Order/Delivery section with no Waiting Queue main-card markup/injector.
- Authenticated Production browser flow verified at 430×932:
  - `/waiting-queue` loads React Build `2026.10.02.331`,
  - Back link is `/?from=waiting-queue`,
  - Back performs full navigation and canonical Home cleans the visible URL to `/`,
  - `Order / Delivery` title height is 20px with 20px line-height and `white-space:nowrap` (one line),
  - description width is 210px and height ~28.34px with ~14.175px line-height (two lines),
  - main nav grid computes to `180px 180px`,
  - visible main cards are Kitchen, Cashier, System Admin, and Staff Admin at 180px each,
  - Waiting Queue main cards = 0.
- Hosting only; no Functions / Firestore Rules / Storage Rules deployment.
- No merge to `main`.

---

## 2026-10-02 — Cashier receive-payment icon semantic refresh

Request:
- Replace the current check-mark icon on the Cashier `รับชำระ` action with an icon that visually represents payment, such as cash / coins / banknotes.
- Apply the change directly without requiring a follow-up confirmation.

Change:
- Replaced `bi-check-circle` with Bootstrap Icons `bi-cash-coin` on all actionable Cashier receive-payment buttons:
  - Delivery order payment,
  - Takeaway order payment,
  - grouped table-bill payment.
- Added semantic class `.cashier-payment-action` to those three buttons so the payment icon can be aligned independently without affecting other confirmation actions.
- Kept `bi-check-circle` on actions that still semantically mean confirmation/completion, including:
  - Lalamove approval/call,
  - hand-over complete,
  - table assignment,
  - already-paid state.
- Added a scoped `bi-cash-coin` alignment rule in `cashier-refresh.css` so the new glyph stays visually centered inside the icon-only Mobile action button.
- Confirmed bundled Bootstrap Icons 1.13.1 contains `bi-cash-coin`.

Regression protection:
- React foundation contract now requires exactly three `bi-cash-coin` payment-action icons.
- Contract requires both single-order `actions.pay(order)` and grouped `actions.payTable(sorted)` paths to use the payment icon.
- Contract requires the scoped Cashier payment icon alignment rule.
- Other check-circle actions are intentionally left unchanged.

Release:
- React `0.4.280 / 2026.10.02.332`
- Public storefront `0.16.32 / 2026.10.02.047`
- Generated React bundle `/react/assets/index-CVnawH9r.js`.

Verification:
- Bootstrap Icons vendor audit confirms `bi-cash-coin::before` exists.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React foundation/migration/parity matrix/P0 action/callable/tenant-access/UI-layer contracts PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.332`.
- `git diff --check` PASS.
- Post-build source audit confirms exactly the three receive-payment action paths use `bi-cash-coin`.

Deploy state:
- Implementation commit: `c727b4df` — `fix: use payment icon for cashier receive actions`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- No Functions / Firestore Rules / Storage Rules deployment was performed.
- Authenticated Production verification on `/cashier` at 430×932 confirmed:
  - footer Build `2026.10.02.332`,
  - generated bundle `/react/assets/index-CVnawH9r.js`,
  - visible `รับชำระ` action has class `.cashier-payment-action`,
  - icon class is `bi bi-cash-coin app-icon`,
  - Bootstrap glyph content resolves correctly,
  - icon box is 18×18 inside the 40×40 Mobile action button,
  - measured icon/button center delta is exactly `x=0, y=0`.
- No merge to `main`.

---

## 2026-10-02 — Cashier Hero order action moved into title row

Request clarification:
- Keep the Quick Order action inside the green Cashier Hero.
- Move it from the lower Hero row to the same horizontal row as `หน้าแคชเชียร์`.
- Shorten the visible label from `รับออเดอร์หน้าร้าน` to `รับออเดอร์`.

Change:
- Reworked the Cashier Hero markup so `cashier.hero.title` and the Quick Order action share a dedicated `.cashier-hero-title-row`.
- The Hero description remains on its own row directly beneath the title/action row.
- Quick Order remains inside `.cashier-hero` and still links to `/cashier/quick-order`.
- Visible button text uses a short localized label:
  - `quick_order.entry.short_button` when available,
  - otherwise the existing localized `kitchen.actions.accept` value (Thai = `รับออเดอร์`).
- Accessibility label/title remain the full Quick Order description/button text.
- Desktop Hero now uses one full-width content block with a title/action flex row.
- Mobile Hero:
  - title and button stay on the same row,
  - title is kept on one line,
  - Quick Order action is compacted to 40px minimum height with reduced padding/gap,
  - description remains below and is not pushed into a separate action row.

Regression protection:
- React foundation contract now requires:
  - `.cashier-hero-title-row` markup,
  - Quick Order action before the takeaway tools section,
  - short localized button label,
  - title-row `justify-content:space-between`,
  - nowrap Mobile title,
  - no regression to the old Mobile `flex-direction:column` Hero action layout.

Release:
- React `0.4.280 / 2026.10.02.333`
- Public storefront `0.16.32 / 2026.10.02.048`
- Generated React bundle `/react/assets/index-C306tXpI.js`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React foundation/migration/parity matrix/P0 action/callable/tenant-access/UI-layer contracts PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.333`.
- `git diff --check` PASS.
- Post-build source audit confirms Quick Order is nested inside the title row and remains above the takeaway tools section.

Deploy state:
- Implementation commit: `93e2e19a` — `fix: align Cashier quick order with Hero title`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- No Functions / Firestore Rules / Storage Rules deployment was performed.
- Authenticated Production verification on `/cashier` at 430×932 confirmed:
  - footer Build `2026.10.02.333`,
  - generated bundle `/react/assets/index-C306tXpI.js`,
  - visible title is `หน้าแคชเชียร์`,
  - visible Quick Order label is `รับออเดอร์`,
  - title center Y = ~112.99px,
  - button center Y = 113.00px,
  - therefore title/button are vertically aligned on the same Hero row,
  - Hero description begins below the title/action row.
- No merge to `main`.

---

## 2026-10-02 — Delivery pagination raw translation key repair

Symptom:
- Desktop Delivery page displayed the literal translation key `common.pagination.summary` directly beneath the menu page buttons.
- The same pagination implementation also used missing raw keys for Previous / Next / Page aria labels, although those were not visibly rendered as text.

Root cause:
- `public/assets/js/dom-menu-pagination.js` referenced `common.pagination.previous`, `common.pagination.next`, `common.pagination.page`, and `common.pagination.summary`.
- The public storefront translation dictionary does not define a top-level `common.pagination` namespace.
- Delivery copy is scoped under `delivery.checkout.menu`.
- The i18n helper intentionally returns the input key when no translation exists, so the missing summary key became visible UI text.

Change:
- Delivery paginator now uses the correct namespace:
  - `delivery.checkout.menu.previous_page`,
  - `delivery.checkout.menu.next_page`,
  - `delivery.checkout.menu.page_aria`,
  - `delivery.checkout.menu.page_summary`.
- Added all four pagination strings to the Delivery checkout menu dictionary for all five supported locales:
  - Thai,
  - English,
  - Myanmar,
  - Lao,
  - Khmer.
- Added a local `translated()` guard in `dom-menu-pagination.js`.
  - If a translation is ever missing again, the paginator uses readable Thai fallback copy rather than exposing an internal translation key.
- Cache-busted the Delivery translation/pagination runtime:
  - `public-i18n-bootstrap.js?v=20261002-007`,
  - `public-translations.js?v=20261002-007`,
  - `dom-menu-pagination.js?v=20261002-001`.
- Updated the optional Delivery bootstrap importer to the same pagination module version.

Regression protection:
- React foundation contract now verifies that Delivery pagination:
  - contains no `common.pagination.*` references,
  - uses all four `delivery.checkout.menu.*` keys,
  - retains a readable fallback guard,
  - loads the new cache identities from the Delivery HTML and i18n bootstrap,
  - retains at least the expected public pagination translations.

Release:
- React `0.4.280 / 2026.10.02.334`
- Public storefront `0.16.32 / 2026.10.02.049`
- Generated React bundle `/react/assets/index-CDvS30sS.js`.

Verification:
- `node --check public/assets/js/public-translations.js` PASS.
- `node --check public/assets/js/dom-menu-pagination.js` PASS.
- Runtime dictionary audit confirmed Previous / Next / Page / Summary are present at `delivery.checkout.menu` for all five locales.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React foundation/migration/parity matrix/P0 action/callable/tenant-access/UI-layer contracts PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.02.334`.
- `git diff --check` PASS.
- Static source audit confirms no `common.pagination` key remains in Delivery pagination.

Deploy state:
- Implementation commit: `9aa29f8b` — `fix: translate Delivery pagination summary`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- No Functions / Firestore Rules / Storage Rules deployment was performed.
- Production verification on `/s/saas-test-shop/delivery` at Desktop viewport confirmed:
  - Thai summary = `หน้า 1 จาก 4 • 37 เมนู`,
  - English summary = `Page 1 of 4 • 37 items`,
  - Myanmar / Lao / Khmer summaries resolve to localized text,
  - raw `common.pagination.*` visible-text scan = empty for all five locales,
  - Previous / Next / Page aria labels are localized in all five locales,
  - page loads `public-i18n-bootstrap.js?v=20261002-007`,
  - page loads `dom-menu-pagination.js?v=20261002-001`.
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

---

## 2026-10-02 — KINJAI visible branding completion

Symptom / request:
- Resume the branding migration and make all user-visible product branding read KINJAI, with compact fallback KJ, while preserving internal FOD/Firebase/repository/schema identifiers.
- Re-audit React and static/compatibility pages because customer Delivery / Takeaway / Success still use static assets in parts of the migration.

Root cause:
- The branch had a newer visible-brand pass using PENGUIN / PG, while the current requested product identity is KINJAI / KJ.
- Branding appeared across React fallbacks, static HTML shells, five-locale translation payloads, QR/receipt labels, parity CSS pseudo-content, release metadata, and regression contracts.
- Remaining uppercase FOD matches are internal translation keys, DOM identifiers, and error codes such as FOD_WALLET_*; renaming them would risk logic compatibility and was intentionally avoided.

Change:
- Replaced visible PENGUIN / PG branding with KINJAI / KJ across React source, static/compatibility HTML/JS/CSS, QR/receipt surfaces, and TH/EN/MY/LO/KM translation payloads.
- Preserved runtime compatibility normalization so legacy LUKKAJA, PENGUIN, Food Order Delivery, FOOD ORDER QR, and standalone visible FOD/PG are normalized to KINJAI / KJ.
- Kept PlatformBrandingRuntime asset precedence:
  - header .brand-mark: App Icon -> Logo -> KJ fallback,
  - login/large brand: Logo -> App Icon -> KJ fallback,
  - favicon: Favicon -> App Icon -> Logo,
  - apple-touch-icon: App Icon first.
- Updated React parity/generated-build contracts so KINJAI / KJ is the required visible identity while old visible brands are rejected.
- Updated current README/handoff branding checkpoint without renaming existing Firebase/Hosting/auth identifiers.
- Prepared fresh release identity for the next Hosting deploy:
  - React 0.4.280 / 2026.10.02.335
  - public storefront 0.16.32 / 2026.10.02.050

Important files:
- react-app/src/components/PlatformBrandingRuntime.jsx
- react-app/src/i18n/I18nProvider.jsx
- react-app/src/i18n/parity-translations.json
- React page branding surfaces under react-app/src/pages/
- react-app/public/parity/css/app.css
- react-app/public/parity/css/admin-retail-pos-parity.css
- react-app/public/parity/css/admin-sales-report-retail-pos-parity.css
- public/assets/js/public-translations.js
- public/assets/js/platform-translations.js
- public/assets/js/home-translations.js
- static canonical/compatibility HTML entrypoints under public/
- tools/react-foundation-contract.mjs
- tools/generated-react-build-contract.mjs
- react-app/src/config/release.js
- public/assets/js/app-info.js
- README.md
- docs/NEXT_CHAT_HANDOFF.md

Verification:
- Source/static audit found no residual user-visible PENGUIN / PG / LUKKAJA / Food Order Delivery / FOOD ORDER QR outside explicit compatibility/test guards.
- FOD_WALLET_*, fod_*, DOM ids, Firebase project/auth app names, and other internal identifiers remain unchanged.
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- React foundation/migration/parity matrix/P0 action/callable/tenant-access/UI-layer contracts PASS.
- npm run build:react PASS after the release-identity bump.
- Generated React build contract PASS for Build 2026.10.02.335 using /react/assets/index-Cg42g7Sl.js.
- git diff --check PASS.

Deploy state:
- Not deployed yet in this worklog entry.
- Hosting only is intended for the next deploy; no Firestore Rules / Storage Rules / Functions change is part of this branding pass.
- No merge to main.

Remaining:
- Deploy Firebase Hosting target foodapp using the prepared fresh Build pair.
- After Hosting deploy, visually verify Header App Icon, Login Logo, favicon/apple-touch-icon, and TH/EN/MY/LO/KM on canonical customer/staff/admin routes.

---

## 2026-10-02 — Compact logo fallback corrected from KJ to PG

Symptom / request:
- Production Login still showed `KJ` inside the fallback logo mark; user clarified the correct compact mark is `PG` while the public product name remains KINJAI.

Root cause:
- The previous branding pass treated `PG` as legacy visible branding and normalized it to `KJ`, so Login, shared headers, static pages, CSS pseudo fallbacks, and translation help all inherited the wrong compact mark.

Change:
- Changed compact visible fallback marks from `KJ` to `PG` across React pages, shared storefront headers, static customer/legal pages, and parity CSS.
- Login large fallback is now `PG`; uploaded Logo/App Icon precedence remains unchanged.
- React i18n no longer converts `PG` to `KJ`; legacy standalone FOD fallback now normalizes to `PG`.
- Updated TH/EN/MY/LO/KM Platform Branding help text and regression contracts to require `PG` and reject visible `KJ`.
- Prepared fresh Hosting identity: React `0.4.280 / 2026.10.02.336`; public storefront `0.16.32 / 2026.10.02.051`.

Verification:
- `npm run test:operational` PASS after installing the missing local Functions dependencies on this Mac.
- `npm run test:react-parity` PASS, including foundation, migration, parity matrix, P0 actions, callables, tenant access, and UI-layer contracts.
- `npm run build:react` PASS; generated build contract PASS for `2026.10.02.336` using `/react/assets/index-82zySSDJ.js`.
- `git diff --check` PASS.
- Visible-source scan found no remaining `KJ` under React/static UI sources; Login source now renders `<div className="login-logo">PG</div>`.

Deploy state:
- Firebase CLI login completed on the current Mac.
- Hosting-only deploy completed successfully to project `chat-45754`, target `foodapp` / site `penguin-food`.
- Production URL: `https://penguin-food.web.app`.
- Deployed React Build: `0.4.280 / 2026.10.02.336`; public storefront Build: `0.16.32 / 2026.10.02.051`.
- No Firestore Rules / Storage Rules / Functions deployment was performed.
- Not committed, not pushed, and not merged in this entry.

---

## 2026-10-02 — Sales Report receipt columns fill available width

Symptom / request:
- On `/admin/sales-report`, the receipt table stopped before the right edge of its card on Desktop, leaving a large empty area instead of distributing the columns across the available width.

Root cause:
- React Sales Report forced the receipt table to `width: max-content !important`; with short/empty data the table therefore sized itself to content rather than the full receipt card.

Change:
- Changed the receipt table to `width: 100% !important` while retaining `min-width: 980px`.
- Desktop now expands columns across the full card width; narrower screens still keep the 980px minimum and use the existing horizontal scroll wrapper.
- Updated the React foundation contract to guard the full-width Desktop behavior.
- Prepared fresh Hosting identity: React `0.4.280 / 2026.10.02.337`; public storefront `0.16.32 / 2026.10.02.052`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for `2026.10.02.337` using `/react/assets/index-D8xzs6_Y.js`.
- `git diff --check` PASS.
- Production `/admin/sales-report` responds 200 and serves `/react/assets/index-D8xzs6_Y.js`.
- Production `/react/parity/css/sales-report-modern.css` confirms `width: 100% !important` with `min-width: 980px !important`.

Deploy state:
- Firebase Hosting-only deploy completed successfully to project `chat-45754`, target `foodapp` / site `penguin-food`.
- No Firestore Rules / Storage Rules / Functions deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — Remove Sales Report button arrow icon

Symptom / request:
- On `/admin`, the Sales Report spotlight action showed an extra right-arrow icon after the `รายงาน` label. User requested removing that arrow while keeping the existing eye icon and button text.

Root cause:
- `AdminPage.jsx` explicitly rendered Bootstrap Icon `bi-arrow-right-short` with class `admin-sales-report-spotlight__arrow`; matching CSS also remained in the Admin visual stylesheet.

Change:
- Removed the `bi-arrow-right-short` element from the Sales Report action.
- Kept the `bi-eye` icon and translated report label unchanged.
- Removed the now-unused desktop/mobile `.admin-sales-report-spotlight__arrow` CSS rules.
- Added a React foundation regression guard so the arrow icon/class cannot reappear.
- Prepared fresh Hosting identity: React `0.4.280 / 2026.10.02.338`; public storefront `0.16.32 / 2026.10.02.053`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for `2026.10.02.338` using `/react/assets/index-C8gNVWfu.js`.
- `git diff --check` PASS.
- Production `/admin` responds 200 and serves `/react/assets/index-C8gNVWfu.js`.
- Production bundle contains zero occurrences of `admin-sales-report-spotlight__arrow` and zero occurrences of `bi-arrow-right-short`.

Deploy state:
- Firebase Hosting-only deploy completed successfully to project `chat-45754`, target `foodapp` / site `penguin-food`.
- No Firestore Rules / Storage Rules / Functions deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — PENGUIN visible-brand cleanup + Admin mobile table swipe repair

Symptom / request:
- Admin Mobile still exposed residual visible `KINJAI` text in QR cards, Lalamove account/approval/credit wording, footer/title surfaces, and related translations.
- The `จัดการโต๊ะ` table overflowed horizontally on Mobile, but swiping left/right did not reliably move the table even though a horizontal scrollbar was visible.

Root cause:
- The previous branding pass left `KINJAI` as the primary visible product text in React/static translation payloads and direct QR/runtime labels while only the compact mark had been corrected to `PG`.
- React pages marked horizontal regions with `data-horizontal-scroll`, but the existing `horizontal-scroll-restore.js` helper was not loaded by the React entry. Native touch scrolling alone was not reliable enough for the Admin table gesture.

Change:
- Standardized visible product branding to `PENGUIN` with compact fallback `PG` across React source, static HTML/JS, TH/EN/MY/LO/KM translations, QR/receipt/privacy/terms/platform/admin surfaces, release metadata, and current handoff docs.
- Preserved internal identifiers such as `fod_*`, `FOD_WALLET_*`, Firebase project/app identifiers, repository names, and the `penguin-food.web.app` Hosting origin.
- Kept a compatibility normalization rule `KINJAI -> PENGUIN` so stale/legacy translated text cannot surface the old visible brand.
- Added React entry loading for `/assets/js/horizontal-scroll-restore.js?v=20261002-001`.
- Extended the helper with touch-drag support for `[data-horizontal-scroll]`: horizontal-intent detection, `touch-action: pan-y`, non-passive horizontal `touchmove`, clamped `scrollLeft`, and preservation of normal vertical page scrolling.
- Added regression contracts for PENGUIN/PG branding, the Admin Mobile table horizontal-scroll wrapper, and the React touch-scroll helper.
- Prepared fresh Hosting identity: React `0.4.280 / 2026.10.02.339`; public storefront `0.16.32 / 2026.10.02.054`.

Verification:
- Visible-source scan found no renderable `KINJAI` under React/static UI sources; the only remaining source occurrence is the intentional compatibility rule `.replaceAll("KINJAI", "PENGUIN")`.
- QR card source renders `PENGUIN`.
- Lalamove Thai translations now include `ใช้บัญชีกลาง PENGUIN`, `รอ PENGUIN อนุมัติ`, and `PENGUIN เครดิตสำหรับ Lalamove`; corresponding EN/MY/LO/KM values were updated too.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for `2026.10.02.339` using `/react/assets/index-BexpQRhU.js`.
- `git diff --check` PASS.
- Headless Chrome touch simulation on a 300px-wide horizontal viewport moved `scrollLeft` from 0 to 150 (max 600), with `touchAction: pan-y` and the touch binding active.
- Production `/admin` responds 200, serves `/react/assets/index-BexpQRhU.js`, has `<title>PENGUIN</title>`, loads the horizontal-scroll helper, and the production helper contains `bindTouchDrag` / `touchmove`.
- Production bundle contains the updated PENGUIN Lalamove wording; production app-info reports product/name `PENGUIN` and public Build `2026.10.02.054`.

Deploy state:
- Firebase Hosting-only deploy completed successfully to project `chat-45754`, target `foodapp` / site `penguin-food`.
- No Firestore Rules / Storage Rules / Functions deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — Waiting Queue mobile header action-bar compaction

Symptom / request:
- On `/cashier/waiting-queue` at Mobile width, the top action bar spaced the Back action too far away from the left-side brand/title cluster.
- The Back button showed only the arrow on narrow screens, and the arrow icon did not look vertically centered inside the control.

Root cause:
- The shared `.app-header` uses `justify-content: space-between`, while Waiting Queue rendered Brand, Back, and Locale as three separate direct children.
- Waiting Queue also had a `max-width:480px` rule that hid the Back label and forced the Back button into a 42px icon-only square.
- The Back icon did not have a dedicated fixed inline-grid box like the already-correct Admin Users/QR back actions.

Change:
- Added `.waiting-header-leading` to group Brand + Back on the left; Locale remains pinned to the far right.
- Reduced header/left-cluster gaps on Mobile.
- Removed the narrow-screen icon-only Back behavior; `ย้อนกลับ` / translated Back text remains visible.
- Added a dedicated 1.15em inline-grid box for the arrow icon with centered placement, line-height 1, and vertical-align middle.
- Kept the canonical full navigation `/?from=waiting-queue` behavior unchanged.
- Added React foundation regression coverage for left grouping, label visibility, locale placement, and vertical icon centering.
- Prepared/deployed fresh Hosting identity: React `0.4.280 / 2026.10.02.340`; public storefront `0.16.32 / 2026.10.02.055`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for `2026.10.02.340` using `/react/assets/index-D69y-0AT.js`.
- `git diff --check` PASS.
- Headless Chrome layout check at 440px: Brand→Back gap = 6px; Back text display = visible; Back icon center delta vs button center ≈ 0.008px; no header horizontal overflow.
- Production `/cashier/waiting-queue` responds 200 and serves `/react/assets/index-D69y-0AT.js`.
- Production Waiting Queue CSS contains the new `.waiting-header-leading`, centered Back icon rules, and visible Mobile Back label rule.

Deploy state:
- Firebase Hosting-only deploy completed successfully to project `chat-45754`, target `foodapp` / site `penguin-food`.
- No Firestore Rules / Storage Rules / Functions deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — Waiting Queue mobile header icon spacing + Hero left alignment

Symptom / request:
- On `/cashier/waiting-queue` Mobile, the person icon still sat slightly too far from the `คิวรอโต๊ะ` label.
- The Hero content was visually centered on Mobile rather than consistently left-aligned.
- Flow badges 1–4 lost the desktop chevron separators because Mobile CSS hid `.waiting-flow i`.

Root cause:
- The mobile header inherited a 6px brand gap for every child, so the person-icon-to-title spacing was still wider than desired.
- The later, more-specific `body.waiting-queue-workspace .waiting-page-header` rule kept `align-items:center`, overriding the earlier responsive `align-items:flex-start` rule and causing the shrink-to-content heading block to sit centered.
- The `max-width:760px` rule explicitly used `.waiting-flow i{display:none}`, and the `max-width:480px` layout converted the flow into a centered 2×2 grid.

Change:
- Reduced only the person-icon-to-title gap on narrow screens using a -3px right margin on the header app icon.
- Added Mobile-specific `align-items:flex-start`, full-width `.waiting-page-heading`, and `text-align:left`.
- Restored visible chevrons on Mobile.
- Changed the <=480px flow to a compact, no-wrap, left-aligned flex sequence so badges 1 → 2 → 3 → 4 match Desktop visual order.
- Added regression coverage for the tighter header icon spacing, Mobile Hero left alignment, visible chevrons, and no-wrap flow.
- Prepared/deployed fresh Hosting identity: React `0.4.280 / 2026.10.02.341`; public storefront `0.16.32 / 2026.10.02.056`.

Verification:
- Synthetic Chrome layout test at 344px: person-icon→title gap = 3px; Hero heading x = 22px inside the 328px card; `text-align:left`; Hero `align-items:flex-start`; 3 chevrons visible; all four badges fit on one row; no horizontal page overflow.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for `2026.10.02.341` using `/react/assets/index-Q376s-R6.js`.
- `git diff --check` PASS.
- Production `/cashier/waiting-queue` responds 200 and serves `/react/assets/index-Q376s-R6.js`.
- Production Waiting Queue CSS contains the -3px header icon spacing, Mobile full-width left-aligned heading, no-wrap flow, and visible Mobile chevron rules.

Deploy state:
- Firebase Hosting-only deploy completed successfully to project `chat-45754`, target `foodapp` / site `penguin-food`.
- No Firestore Rules / Storage Rules / Functions deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — Delivery Google login post-OAuth diagnostic staging

Symptom / request:
- Google OAuth redirect mismatch was corrected, but Delivery still ended with the generic toast `เข้าสู่ระบบ Google ไม่สำเร็จ` after attempting Google sign-in.
- The existing UI hid the actual Firebase/Auth/Functions error, so it was impossible to distinguish popup failure from callable/custom-token failure without DevTools.

Investigation:
- Production popup network was inspected directly. Firebase sends the exact OAuth client `1046915702525-dchkgc1n6t3g39f2no8afqvfg5cmgr5f.apps.googleusercontent.com` with redirect URI `https://penguin-food.web.app/__/auth/handler`.
- Google accepts that client + redirect pair and proceeds to the normal sign-in page; `redirect_uri_mismatch` is no longer reproducible.
- Firebase public project config confirms `penguin-food.web.app` is in Authorized Domains.
- Delivery route `/s/saas-test-shop/delivery` resolves tenant ID `13c9bb08-927b-4f9c-a2ef-b320ef7eed99`.
- `createDeliveryCustomerSession` exists in `asia-southeast1` and answers CORS preflight from `https://penguin-food.web.app`.

Change:
- Added explicit login stages in `customer-profile-service.js`: `google_popup`, `customer_session`, `custom_token`, and `session_verify`.
- Preserved the original Firebase error object/code while attaching `customerStage`.
- Corrected frontend mappings for real Firebase popup codes including `auth/popup-blocked`, `auth/popup-closed-by-user`, and `auth/cancelled-popup-request`.
- Unknown login failures now display the localized base message plus `[stage: code]` so the next production attempt identifies the exact failing layer without opening DevTools.
- Prepared/deployed Hosting identity: React `0.4.280 / 2026.10.02.342`; public storefront `0.16.32 / 2026.10.02.057`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for `2026.10.02.342` using `/react/assets/index-C9TX2XyU.js`.
- `git diff --check` PASS.
- Production Delivery responds 200.
- Production `delivery-addresses.js` contains the new stage/code diagnostic path and corrected Firebase popup error mappings.
- Production app-info reports public Build `2026.10.02.057`.

Deploy state:
- Firebase Hosting-only deploy completed successfully to project `chat-45754`, target `foodapp` / site `penguin-food`.
- No Firestore Rules / Storage Rules / Functions deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — Delivery Google customer custom-token IAM repair

Symptom / request:
- After Google OAuth succeeded, Delivery still failed with toast diagnostic `[customer_session: functions/internal]`.

Root cause:
- Cloud Function logs for `createDeliveryCustomerSession` showed an unhandled Firebase Admin error at `createCustomToken()`:
  `Permission 'iam.serviceAccounts.signBlob' denied`.
- The Gen 2 runtime service account is `1046915702525-compute@developer.gserviceaccount.com`.
- Its own service-account IAM policy did not include `roles/iam.serviceAccountTokenCreator`, so Firebase Admin could not sign the custom customer token.

Change:
- Added `roles/iam.serviceAccountTokenCreator` to the runtime service account's **own service-account IAM policy**, with the runtime service account itself as the member.
- Scope is limited to that single service account; no project-wide Token Creator grant was added.
- No application code change was required for the IAM repair.

Verification:
- Service-account IAM policy update succeeded.
- Post-update policy confirms the runtime account now has `roles/iam.serviceAccountTokenCreator`.
- Existing Hosting diagnostic Build remains React `0.4.280 / 2026.10.02.342`, public `0.16.32 / 2026.10.02.057`.
- User should retry Google sign-in after IAM propagation; if another stage fails, the deployed diagnostic toast will identify it.

Deploy state:
- IAM change applied directly in Google Cloud/Firebase; no additional Hosting/Functions deploy was required.
- No Firestore Rules / Storage Rules deployment.

---

## 2026-10-02 — Delivery customer-name / logout row alignment

Symptom / request:
- On signed-in Delivery, the customer name appeared below the account section title while the logout icon was absolutely positioned in the top-right of the card, so they were not on the same visual row.

Root cause:
- `#customerLogoutButton` used `position:absolute; top:10px; right:10px`, anchoring it to the card instead of the signed-in customer row.

Change:
- Moved `#customerLogoutButton` into a new `.delivery-account-user-row` beside `#customerAccount`.
- The row now uses flex alignment with `align-items:center` and `justify-content:space-between`.
- Logout is now `position:static`, fixed at 30×30px, and vertically centered in the row.
- Customer name stays left, truncates safely, and the logout icon stays at the right edge.
- Removed the extra account-section title right padding that was only needed for the previous absolute button.
- Bumped Delivery CSS cache key to `20261002-037`.
- Prepared/deployed Hosting identity: React `0.4.280 / 2026.10.02.343`; public storefront `0.16.32 / 2026.10.02.058`.

Verification:
- Synthetic Chrome layout test at a 391px account card: customer-name center Y and logout-button center Y are identical (delta 0px); button is fully inside the row; no overflow.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for `2026.10.02.343` using `/react/assets/index-AW4AgMLr.js`.
- `git diff --check` PASS.
- Production Delivery responds 200.
- Production markup contains `.delivery-account-user-row`; production CSS confirms centered flex alignment and static logout positioning.

Deploy state:
- Firebase Hosting-only deploy completed successfully to project `chat-45754`, target `foodapp` / site `penguin-food`.
- No Firestore Rules / Storage Rules / Functions deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — Revenue Share loading-spinner spacing

Symptom / request:
- On `/reports/revenue-share`, the loading spinner inside the Hero refresh button sat too close to the `กำลังโหลด...` label.
- The same spinner component is reused by the slip-upload submit button, so both loading-button states needed consistent spacing.

Root cause:
- The Revenue Share Hero button had no dedicated inline-flex gap rule.
- Even after adding an 8px flex gap, the rotating 17px spinner's transformed bounding box visually reduced the apparent spacing to roughly 4–5px while spinning.

Change:
- Made the Hero refresh button and slip-submit button explicit inline-flex controls with centered vertical alignment and `gap:8px`.
- Added `margin-right:4px` specifically to `.tenant-button-spinner` inside those Revenue Share buttons so the rotating spinner keeps a comfortable visible separation without widening normal non-loading icons.
- Updated the React foundation regression contract to guard the spinner/text spacing.
- Prepared/deployed Hosting identity: React `0.4.280 / 2026.10.02.344`; public storefront `0.16.32 / 2026.10.02.059`.

Verification:
- Synthetic Chrome layout check confirmed computed button gap = 8px, spinner right margin = 4px, and the effective visible spinner-to-label gap while rotating ≈ 11px.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for `2026.10.02.344` using `/react/assets/index-WbMiYSgu.js`.
- `git diff --check` PASS.
- Production `/reports/revenue-share` responds 200 and serves `/react/assets/index-WbMiYSgu.js`.
- Production Revenue Share CSS contains the new centered inline-flex gap and spinner-specific margin.

Deploy state:
- Firebase Hosting-only deploy completed successfully to project `chat-45754`, target `foodapp` / site `penguin-food`.
- No Firestore Rules / Storage Rules / Functions deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — Change Password modal vertical centering on Mobile

Symptom / request:
- On `/admin` Mobile, the shared `เปลี่ยนรหัสผ่าน` modal sat too low in the viewport instead of being visually centered on the Y axis.

Root cause:
- The shared Mobile rule explicitly changed `.owner-password-backdrop` to `align-items:end`, forcing the dialog toward the bottom edge.
- After switching the backdrop back to centered alignment, the visible dialog was still 8px above the true viewport center because the modal is a `<form>` inheriting a global `margin-bottom:16px`; CSS Grid centered the form's margin box rather than the visible border box.

Change:
- Mobile `.owner-password-backdrop` now uses `align-items:center` and `justify-items:center`.
- Added `margin:0` to `.owner-password-dialog` so the visible modal frame itself is centered exactly.
- Preserved the existing Mobile max-height / internal scrolling behavior for short viewports.
- Added React foundation regression coverage preventing the bottom-aligned Mobile rule from returning and requiring the modal margin reset.
- Prepared/deployed Hosting identity: React `0.4.280 / 2026.10.02.345`; public storefront `0.16.32 / 2026.10.02.060`.

Verification:
- Synthetic Chrome layout test at 440×956: dialog center Y = 478px, viewport center Y = 478px, delta = 0px.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for `2026.10.02.345` using `/react/assets/index-2QlW0qOs.js`.
- `git diff --check` PASS.
- Production `/admin` responds 200 and serves `/react/assets/index-2QlW0qOs.js`.
- Production parity CSS confirms centered Mobile backdrop alignment and `margin:0` on the password dialog.

Deploy state:
- Firebase Hosting-only deploy completed successfully to project `chat-45754`, target `foodapp` / site `penguin-food`.
- No Firestore Rules / Storage Rules / Functions deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — Revenue Share history date display format

Symptom / request:
- In `/reports/revenue-share` → `ประวัติการส่งสลิป`, daily payment period labels were rendered as raw ISO dates such as `2026-09-03`.
- User requested display format `DD/MM/YYYY`, e.g. `03/09/2026`.

Root cause:
- The history card rendered `item.period.label` directly. Daily period labels are stored as `YYYY-MM-DD`, so the storage/query format leaked into the UI.

Change:
- Added `displayHistoryPeriodLabel()` in `RevenueShareReportPage.jsx`.
- Exact `YYYY-MM-DD` values are now rendered as `DD/MM/YYYY`.
- Non-daily/custom labels are preserved unchanged, so stored/query values and report filtering behavior are not modified.
- Added React foundation regression coverage for the conversion and history rendering call.
- Prepared/deployed Hosting identity: React `0.4.280 / 2026.10.02.346`; public storefront `0.16.32 / 2026.10.02.061`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for `2026.10.02.346` using `/react/assets/index-DFpffcm5.js`.
- `git diff --check` PASS.
- Production `/reports/revenue-share` responds 200 and serves `/react/assets/index-DFpffcm5.js`.
- Production app-info reports public Build `2026.10.02.061`.

Deploy state:
- Firebase Hosting-only deploy completed successfully to project `chat-45754`, target `foodapp` / site `penguin-food`.
- No Firestore Rules / Storage Rules / Functions deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — Admin Lalamove account Laravel parity + central approval state sync

Symptom / request:
- React `/admin` “บัญชี Lalamove ของร้าน” did not visually match the Laravel reference: it showed `รอ PENGUIN อนุมัติ`, hid the transfer/top-up area, and used the longer `บันทึกบัญชี Lalamove` action label.
- Laravel reference showed a ready central account and the complete credit top-up panel.

Laravel source comparison:
- Cloned `Natchanon45/food-order-app-laravel9-php80` `main` at `29e3ad7` to a temporary read-only comparison checkout.
- React already contains the same Lalamove wallet/top-up IDs/classes and readiness rule as Laravel:
  destination summary, amount control, slip picker, submit action, help text, credit policy, top-up history, and ledger.
- React `admin-delivery-fee-row-alignment.css` matches the Laravel source for the Lalamove/wallet section.
- Therefore the missing top-up UI was not a CSS/markup omission. The Firebase tenant state had `accountMode=fod_central` but `fodCentralApproved=false`; the Laravel reference tenant was already in the ready/approved state.

Change:
- Synced the SaaS test tenant central-account approval state to `fodCentralApproved=true` with an approval timestamp, preserving all other tenant Lalamove settings.
- Verified the platform central Lalamove credentials are configured/verified and the Firebase slip receiver destination is configured, so the existing Laravel-equivalent readiness logic now exposes the top-up panel.
- Did **not** fabricate or overwrite wallet credits. Firebase wallet balance remains its real value; the Laravel screenshot’s 500-credit balance was not copied.
- Did **not** overwrite the Firebase payment receiving account from the screenshot; the system continues to use its configured receiver data.
- Shortened the visible save action to Laravel screenshot parity: TH `บันทึก`, EN `Save`, with compact equivalents for MY/LO/KM.
- Added React foundation guards for the compact save label and for retention of the complete Laravel-parity Lalamove wallet/top-up structure/readiness semantics.
- Prepared/deployed Hosting identity: React `0.4.280 / 2026.10.02.347`; public storefront `0.16.32 / 2026.10.02.062`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for `2026.10.02.347` using `/react/assets/index-DAJtroOY.js`.
- `git diff --check` PASS.
- Post-change Firebase state: central approval true; account mode `fod_central`; platform Lalamove API key/secret present; central connection verified; receiver destination configured.
- Production `/admin` responds 200 and serves `/react/assets/index-DAJtroOY.js`.
- Production bundle has zero occurrences of the old Thai save label `บันทึกบัญชี Lalamove`.

Deploy state:
- Firebase Hosting-only deploy completed successfully to project `chat-45754`, target `foodapp` / site `penguin-food`.
- Tenant approval state was synchronized directly in Firestore to match the Laravel-approved central-account state.
- No Firestore Rules / Storage Rules / Functions deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — Super Admin Tenant central-Lalamove approval gate restored

Symptom / request:
- Production `/admin/tenants` showed tenant Lalamove state as disabled and did not expose the central-account approval/revoke action found in Laravel MASTER.
- A tenant must not be able to top up or consume PENGUIN central Lalamove credits before explicit Super Admin approval.

Root cause:
- React `TenantCard` already had the Laravel-equivalent approval button and toggle handler, but visibility depends on `tenant.lalamove.accountMode === "fod_central"`.
- Production tenant-list data could arrive without the nested `lalamove` state, so React normalized it to `disabled` and hid the action even when Firestore `tenants/{tenantId}/settings/lalamove` was actually `fod_central`.

Change:
- `platformTenantService.listTenants()` now hydrates each tenant's authoritative public `settings/lalamove` and `settings/lalamoveWallet` documents after the callable tenant list returns.
- Normalized legacy backend mode `partner` to the UI mode `tenant`.
- Preserved Laravel behavior: approval/revoke action renders only for `fod_central`.
- Kept the existing callable `updateTenantLalamoveApproval` as the only UI approval mutation path.
- Restored the SaaS test tenant to `fodCentralApproved=false` and cleared its approval timestamp, undoing the temporary manual approval from the previous parity investigation.
- Added React contract coverage for authoritative Lalamove hydration and the approval button.
- Added operational contract coverage that central Lalamove dispatch requires `fodCentralApproved=true`, and central-wallet top-up rejects unapproved tenants.
- Release identity: React `0.4.280 / 2026.10.02.348`; public storefront `0.16.32 / 2026.10.02.063`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated build contract PASS for `2026.10.02.348`, bundle `/react/assets/index-C3nqvAra.js`.
- `git diff --check` PASS.
- Post-deploy production bundle contains both the authoritative Lalamove hydration marker and the approval-action marker.
- Firestore check for `saas-test-shop`: `accountMode=fod_central`, `fodCentralApproved=false`, approval timestamp null.

Deploy state:
- Firebase Hosting-only deploy completed successfully to project `chat-45754`, target `foodapp` / site `penguin-food`.
- No Firestore Rules / Storage Rules / Functions deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — Super Admin Lalamove approval no longer blocks on full tenant reload

Symptom / request:
- Clicking `อนุมัติ PENGUIN Lalamove` on `/admin/tenants` often felt like the page was hanging.

Root cause:
- Cloud Function logs showed the first `updateTenantLalamoveApproval` request after idle incurred a Gen 2 cold start of about 5 seconds.
- After the callable completed, React then executed `await loadTenantList()`, which set the whole tenant page back to loading and rehydrated Lalamove + wallet documents for every tenant. This second full refresh made the UI continue looking stuck even though the approval write had already succeeded.

Change:
- Added per-tenant `lalamoveApprovalBusy` state.
- Only the clicked approval/revoke button is disabled while the callable is pending and displays the existing tenant spinner.
- The callable result is now merged directly into that tenant's local `lalamove` state.
- Removed the blocking `await loadTenantList()` from the approval handler; the page no longer reloads every tenant after one approval.
- Added foundation/P0 regression coverage so approval cannot regress to a full tenant-list reload.
- Release identity: React `0.4.280 / 2026.10.02.349`; public storefront `0.16.32 / 2026.10.02.064`.

Verification:
- Recent Cloud Function log confirmed cold-start startup delay on the approval callable; this is separate from the removed client-side full reload.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated build contract PASS for `2026.10.02.349`, bundle `/react/assets/index-C4IpzRU2.js`.
- `git diff --check` PASS.
- Production `/admin/tenants` responds 200 and serves `/react/assets/index-C4IpzRU2.js`.
- Production bundle includes the updated Lalamove approval and tenant-state hydration code.

Deploy state:
- Firebase Hosting-only deploy completed successfully to project `chat-45754`, target `foodapp` / site `penguin-food`.
- No Firestore Rules / Storage Rules / Functions deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — Approved central Lalamove masked credentials + bank-name display

Symptom / request:
- After Super Admin approved PENGUIN central Lalamove, tenant Admin still showed generic `pk_...` / `sk_...` placeholders instead of partially masked central credentials like Laravel MASTER.
- Wallet top-up transfer destination showed the raw Slip2Go bank code `01014` instead of the bank name.

Root cause:
- `getTenantLalamoveSettings` returned only tenant/Partner credential masks (`tenantApiKeyMasked`, `tenantApiSecretMasked`). It did not expose a safe masked view of the approved platform-central credentials, so central mode fell back to generic placeholders.
- Wallet destination already carried the configured receiver bank code, and the React parity dictionary already had the Laravel bank-name map, but Admin rendered `accountTypeLabel || accountType` directly.

Change:
- `tenantLalamoveStatus()` now returns only **masked** central credentials after `fodCentralApproved === true`:
  - `platformApiKeyMasked`
  - `platformApiSecretMasked`
  - matching configured flags
- Before approval these values remain empty, so no central credential mask is exposed prematurely.
- Admin chooses Partner masks for tenant mode and platform-central masks for approved `fod_central` mode.
- Wallet destination bank code now resolves through `platform.slip_verification.receiver_account_types.{code}`; Thai `01014` displays `ธนาคารไทยพาณิชย์ (SCB)`.
- Added frontend and operational regression guards for approved-only central masks and bank-name parity.
- Release identity: React `0.4.280 / 2026.10.02.350`; public storefront `0.16.32 / 2026.10.02.065`.

Verification:
- `node --check functions/tenant-lalamove-wallet.js` PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated build contract PASS for `2026.10.02.350`, bundle `/react/assets/index-CR3_D_1E.js`.
- `git diff --check` PASS.
- Production function `getTenantLalamoveSettings` is ACTIVE on revision `gettenantlalamovesettings-00002-yad` with update time `2026-10-02T14:44:11.502898764Z`.
- Production platform-central key and secret are configured with valid environment prefixes; no raw credential was printed during verification.
- Production bundle contains `platformApiKeyMasked`, `platformApiSecretMasked`, bank-map lookup, and `ธนาคารไทยพาณิชย์ (SCB)`.
- Production `/admin` responds 200 and app-info reports public Build `2026.10.02.065`.

Deploy state:
- Deployed only Cloud Function `getTenantLalamoveSettings` plus Hosting target `foodapp`.
- No Firestore Rules / Storage Rules deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — Public Delivery now uses live Lalamove quotation

Symptom / request:
- Tenant Admin had approved and selected the PENGUIN central Lalamove account and had sufficient central-wallet credit, but `/s/{slug}/delivery` still calculated delivery using the store's Google Routes distance tiers (for example the 10+ km / 100 Baht tier) instead of calling Lalamove.

Root cause:
- The Firebase customer Delivery runtime had no public Lalamove quotation bridge. `public/assets/js/delivery.js` always used `computeDeliveryRoute` plus `deliveryFeeOptions`.
- Firebase already had `quoteTenantLalamoveDispatch`, but that callable intentionally requires an authenticated staff user and an existing delivery order, so it cannot be used by the public checkout.
- Laravel MASTER already has a separate public quotation flow before order creation; that path had not yet been ported to Firebase.

Change:
- Added public callable `quotePublicLalamoveDelivery`.
  - Resolves the storefront by slug.
  - Requires the tenant's store setting `deliveryProvider=lalamove`.
  - Reuses the existing tenant/central Lalamove account resolver, including central Super Admin approval and verified API credentials.
  - Requests a live Lalamove MOTORCYCLE quotation for the store/customer coordinates.
  - Supports the existing COD special-request check.
  - Returns quotation data plus safe account mode/environment only; API key/secret are never returned.
- Added `publicStorefrontService.getLalamoveQuotation()` through the isolated customer Functions app.
- Ported Laravel Lalamove checkout behavior into the Firebase Delivery runtime:
  - Lalamove mode no longer falls back to the store's manual distance tiers.
  - Location/payment-method changes request or refresh the live Lalamove quotation.
  - The delivery selector/status shows the Lalamove live fee.
  - Checkout is blocked when the live quote is missing/failed/out of range.
  - Orders persist `deliveryProvider=lalamove`, `deliveryFeeMode=lalamove_quotation`, quotation ID/expiry/currency/account mode/environment, and the complete safe dispatch quote snapshot.
- Free-shipping promotion semantics are preserved: the customer-facing `deliveryFee` may be 0, while `deliveryBaseFee` and `lalamoveDispatchFee` retain the actual Lalamove provider fee for dispatch/wallet accounting.
- Added foundation and operational regression guards for the public quotation bridge and Lalamove order metadata.
- Cache identities bumped for Delivery and the storefront service.
- Release identity: React `0.4.280 / 2026.10.02.351`; public storefront `0.16.32 / 2026.10.02.066`.

Verification:
- `node --check functions/lalamove-dispatch.js` PASS.
- `node --check public/assets/js/delivery.js` PASS.
- `node --check public/assets/js/public-storefront-service.js` PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React callable contract PASS; no missing Functions exports.
- `npm run build:react` PASS.
- Generated React build contract PASS for `2026.10.02.351`, bundle `/react/assets/index-X-Oom4WM.js`.
- `git diff --check` PASS.
- Production public callable was invoked anonymously for `saas-test-shop` at the Delivery coordinates shown during testing and returned HTTP 200 with a real quotation:
  - quotation ID present
  - fee 70 THB
  - distance 8.5 km
  - accountMode `fod_central`
  - accountEnvironment `sandbox`
  - expiry present
  - no credential fields returned
- Production Delivery HTML serves `delivery.js?v=20261002-007`.
- Production Delivery runtime contains the live quotation call, `deliveryProvider=lalamove`, and `lalamove_quotation` order mode.
- Production storefront service contains `quotePublicLalamoveDelivery`.
- Production app-info reports public Build `2026.10.02.066`; `/s/saas-test-shop/delivery` responds 200.

Deploy state:
- Deployed only Cloud Function `quotePublicLalamoveDelivery` plus Hosting target `foodapp` to Firebase project `chat-45754`.
- No Firestore Rules / Storage Rules deployment.
- Not committed, not pushed, and not merged.

---

## 2026-10-02 — Cashier cancel-all Chrome hang fix

Symptom:
- After Cashier -> "ยกเลิกทุกรายการ" -> confirm, Chrome became unresponsive across the whole application and required macOS Force Quit.

Evidence / root cause:
- macOS unified log confirms Google Chrome PID 27379 was force-quit at 22:32:39.
- No crash/minidump or memory-pressure termination was recorded, which is consistent with a renderer/main-thread hang rather than a normal crash.
- The shared React Top Layer manager had a Popover feedback loop: every layer enforcement unconditionally called hidePopover() then showPopover(); those operations emit "toggle", and the global toggle listener scheduled another enforcement. A Cashier cancellation completes by showing an app Toast, which could start this repeated hide/show cycle.

Fix:
- Made react-app/src/ui/toast-top-layer.js promotion idempotent.
- An already-open overlay in the correct host is no longer hidden and reopened.
- Popovers are only hidden before moving to a different native-modal host, and only opened when currently closed.
- Preserved the required Toast > Sweet Dialog > Modal policy.
- Added a UI-layer contract regression guard for the idempotent promotion behavior.
- Release bumped to React 0.4.280 / 2026.10.02.352 and public storefront 0.16.32 / 2026.10.02.067.

Verification:
- Chrome/Playwright runtime test with native modal + Sweet Dialog + Toast: each overlay produced exactly 1 open toggle and 1 close toggle; no feedback loop.
- node --check react-app/src/ui/toast-top-layer.js PASS.
- npm run test:ui-layers PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- npm run build:react PASS.
- Generated React build contract PASS: /react/assets/index-FEe-Lw0s.js, Build 2026.10.02.352.
- git diff --check PASS.
- Hosting-only deploy to Firebase project chat-45754 / target foodapp succeeded.
- Production /cashier now serves /react/assets/index-FEe-Lw0s.js.
- Post-deploy production Playwright test again confirmed exactly 1 open + 1 close toggle for Toast and Sweet Dialog inside a native modal.

Deploy state:
- Hosting deployed successfully.
- No Functions, Firestore Rules, or Storage Rules deployed for this fix.
- Not committed, not pushed, and not merged.

---

## 2026-10-03 — Cashier/Kitchen click-freeze: React overlay ownership hardening

Symptom:
- After using several actions on Cashier or Kitchen, the page could eventually stop accepting clicks.
- The issue could occur whether or not a visible Toast appeared, so the earlier Popover toggle-loop fix did not fully explain the symptom.

Investigation:
- Production tenant saas-test-shop has only 18 order documents (~0.15 MB REST payload), so an oversized realtime order snapshot was ruled out.
- No Chrome GPU/ANGLE/Metal context-loss or memory-pressure crash was found in the inspected macOS logs.
- Cashier/Kitchen entrypoints load the React bundle only; legacy cashier.js/kitchen.js are not double-bound.
- Shared Auth/Tenant recheck, notifier timer, branding observer and validation observer showed no recursive loop.
- A stricter DOM stress test exposed that the .353 Top Layer manager could move a React-owned .sweet-dialog-backdrop from its component host to document.body.
- Cashier TableMoveDialog is React-owned JSX using .sweet-dialog-backdrop.show. Manual reparenting can break React DOM ownership and can leave an orphan fixed full-screen backdrop. Because .sweet-dialog-backdrop.show has pointer-events:auto, such an orphan can intercept every click and make the page appear frozen.

Fix:
- Top Layer runtime now treats only overlays that originate as direct children of document.body as portable.
- React-owned overlays nested under #root/component hosts are never manually reparented or promoted.
- Ordinary Cashier/Kitchen pages never enter Chromium Popover Top Layer.
- Body-originating imperative overlays may still move into a native showModal() host when required, and are restored to document.body after the native modal closes.
- The Popover toggle self-listener remains removed.
- UI-layer static contract now guards React DOM ownership, portable-overlay restoration, idempotent native-modal promotion, and absence of toggle self-scheduling.
- React release: 0.4.280 / 2026.10.03.354.
- Public release: 0.16.32 / 2026.10.03.069.

Verification:
- Local Chrome runtime ownership stress: 1,000 React-owned backdrop mount/unmount cycles; ownership moves 0, ordinary Popovers 0, orphan backdrops 0, overlays left 0.
- Native modal test: body-originating imperative overlay promoted correctly; nested React-owned overlay stayed in its component host; portable overlay restored to body after modal close.
- Local heap after GC: 1.14 MB -> 1.27 MB.
- node --check react-app/src/ui/toast-top-layer.js PASS.
- npm run test:ui-layers PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- npm run build:react PASS.
- Generated React build contract PASS for 2026.10.03.354, bundle /react/assets/index-iXAtx9sU.js.
- git diff --check PASS.
- Hosting-only deploy to Firebase project chat-45754 / target foodapp succeeded.
- Production Cashier serves /react/assets/index-iXAtx9sU.js; public app-info reports 2026.10.03.069.
- Post-deploy production Chrome stress: 700 React-owned backdrop cycles; ownership moves 0, Popovers 0, orphan backdrops 0, overlays left 0; heap 7.51 MB -> 7.58 MB after GC.

Deploy state:
- Hosting deployed successfully.
- No Functions, Firestore Rules, or Storage Rules deployed for this fix.
- Not committed, not pushed, and not merged.

---

## 2026-10-03 — Public unavailable storefront refresh + OS system font

Request:
- Refresh the public "ร้านไม่พร้อมให้บริการ" state shown on Delivery when a tenant is expired, suspended, inactive, missing, or otherwise unavailable.
- The unavailable state must use the operating system font stack and must not load or declare a custom @font-face.

Change:
- Rebuilt the standalone unavailable storefront emitted by public/assets/js/public-tenant-resolver.js.
- Added a cleaner responsive status card with:
  - storefront status icon
  - PENGUIN / หน้าร้านออนไลน์ context label
  - clearer title/detail hierarchy
  - compact recovery note
  - Back and Reload actions
  - desktop two-column actions and mobile single-column actions
- Font is now explicitly isolated to the OS stack:
  - system-ui
  - -apple-system
  - BlinkMacSystemFont
  - Segoe UI
  - sans-serif
- No @font-face declaration or external stylesheet is used by the standalone unavailable document.
- Added HTML escaping for reason/detail before inserting them into the standalone document.
- Updated public-tenant-resolver cache identity to 20261003-007 across Delivery, Delivery Success, Takeaway, Order, and their module import bridges.
- Added a React foundation regression contract requiring the system-font stack, the refreshed standalone state, Retry action, and absence of @font-face.
- Release identity: React 0.4.280 / 2026.10.03.355; public storefront 0.16.32 / 2026.10.03.070.

Important files:
- public/assets/js/public-tenant-resolver.js
- public/delivery/index.html
- public/delivery/success/index.html
- public/takeaway/index.html
- public/order/index.html
- public/assets/js/delivery-bootstrap.js
- public/assets/js/customer-secure.js
- public/assets/js/delivery.js
- public/assets/js/table-qr-resolver.js
- public/assets/js/takeaway-order.js
- tools/react-foundation-contract.mjs
- react-app/src/config/release.js
- public/assets/js/app-info.js
- README.md
- docs/NEXT_CHAT_HANDOFF.md

Verification:
- node --check public/assets/js/public-tenant-resolver.js PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- React foundation contract PASS including unavailable-storefront system-font guard.
- npm run build:react PASS.
- Generated React build contract PASS for 2026.10.03.355, bundle /react/assets/index-B5zy5bxI.js.
- git diff --check PASS.
- Hosting-only deploy to Firebase project chat-45754 / target foodapp succeeded.
- Production public-tenant-resolver.js?v=20261003-007 contains the required system font stack and contains no @font-face.
- Production renderer browser harness using the deployed resolver:
  - Desktop 1440x900: card 480px wide, centered X/Y, two action columns.
  - Mobile 390x844: card 354px wide, centered X/Y, one action column.
  - body/title/button computed font family all resolve through system-ui / -apple-system / Segoe UI / sans-serif.
  - external stylesheet count 0 and @font-face count 0 in the standalone state.
- saas-test-shop itself is currently active again, so the production visual harness invoked the exact deployed renderer without changing tenant/Firestore state.

Deploy state:
- Hosting deployed successfully.
- No Functions, Firestore Rules, or Storage Rules deployed for this change.
- Not committed, not pushed, and not merged.

---

## 2026-10-03 — Correct unavailable storefront font to Kanit system UI font

Correction:
- The previous unavailable-storefront pass interpreted "system font" as the operating-system UI stack.
- Project UI source of truth is Kanit Local, matching public/assets/css/app.css.

Change:
- Removed the unavailable page's OS system stack completely.
- Added the same local Kanit font faces used by the application:
  - /assets/fonts/Kanit-Regular.ttf for weight 400
  - /assets/fonts/Kanit-SemiBold.ttf for weights 600/700/800/900
- The standalone unavailable document now uses only "Kanit Local" through --app-ui-font.
- Removed system-ui/-apple-system/Segoe UI from this standalone state.
- Updated regression contract to require local Kanit assets and reject system-ui.
- Bumped public-tenant-resolver cache identity to 20261003-008 across Order, Delivery, Delivery Success, Takeaway and module bridges.
- Release identity: React 0.4.280 / 2026.10.03.356; public storefront 0.16.32 / 2026.10.03.071.

Verification:
- node --check public/assets/js/public-tenant-resolver.js PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- React foundation contract PASS with Kanit-only unavailable-state guard.
- npm run build:react PASS.
- Generated React build contract PASS for 2026.10.03.356, bundle /react/assets/index-CHubCyBg.js.
- git diff --check PASS.
- Hosting-only deploy to Firebase project chat-45754 / target foodapp succeeded.
- Production browser verification on penguin-food.web.app:
  - Kanit-Regular.ttf HTTP 200, content-type font/ttf
  - Kanit-SemiBold.ttf HTTP 200, content-type font/ttf
  - body computed font: "Kanit Local" weight 400
  - unavailable title computed font: "Kanit Local" weight 700
  - detail computed font: "Kanit Local" weight 400
  - action button computed font: "Kanit Local" weight 600
  - document.fonts confirms regular, semibold and bold faces loaded
  - no system-ui token remains in the deployed standalone renderer
  - card remains centered X/Y.

Deploy state:
- Hosting deployed successfully.
- No Functions, Firestore Rules, or Storage Rules deployed for this correction.
- Not committed, not pushed, and not merged.

---

## 2026-10-03 — Unavailable storefront: store name + action icons

Request:
- Show the resolved store name on the unavailable storefront state.
- Add icons to Back and Reload actions while keeping Kanit as the project UI font.

Change:
- showUnavailableStorefront() now accepts an optional storeName.
- Inactive/expired tenants pass the already-resolved tenant.name into the unavailable state; no additional Firestore query is required.
- Added .storefront-state__store-name between the PENGUIN storefront context label and the unavailable-status heading.
- Added inline SVG icons:
  - chevron-left for ย้อนกลับ
  - refresh arrow for โหลดใหม่อีกครั้ง
- Action buttons now use inline-flex, center alignment and an 8px icon/text gap.
- Store name and actions continue to use local Kanit only.
- Updated regression contract to require tenant.name wiring, store-name UI, both action IDs and both SVG path markers.
- Resolver cache identity: 20261003-009.
- Release identity: React 0.4.280 / 2026.10.03.357; public storefront 0.16.32 / 2026.10.03.072.

Verification:
- node --check public/assets/js/public-tenant-resolver.js PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- React foundation contract PASS.
- npm run build:react PASS.
- Generated React build contract PASS for 2026.10.03.357, bundle /react/assets/index-DrxgK4iz.js.
- git diff --check PASS.
- Hosting-only deploy to Firebase project chat-45754 / target foodapp succeeded.
- Production resolver browser harness verified:
  - storeName renders as ร้านทดสอบ SaaS from the passed resolved tenant value
  - store name computed font is "Kanit Local"
  - Back and Retry each contain exactly one SVG icon
  - both buttons use flex layout, align-items:center and 8px icon/text gap
  - Production public Build 2026.10.03.072
  - Resolver cache 20261003-009.

Deploy state:
- Hosting deployed successfully.
- No Functions, Firestore Rules, or Storage Rules deployed.
- Not committed, not pushed, and not merged.

---

## 2026-10-03 — Unavailable storefront store name uses Admin shopName

Issue:
- The unavailable storefront showed tenant.name ("ร้านทดสอบ SaaS") instead of the store name configured on the Admin page.
- The Admin page source of truth is tenants/{tenantId}/settings/store.shopName.

Fix:
- Added configuredStoreName(tenant) to public-tenant-resolver.js.
- The unavailable storefront now reads tenants/{tenantId}/settings/store and uses settings.shopName.
- tenant.name remains fallback only when shopName is missing or settings cannot be read.
- No extra query is performed for active storefront rendering; the settings read is only needed when rendering the inactive/expired storefront state.
- Regression contract now requires the exact Admin settings/store document path and shopName field.
- Resolver cache identity: 20261003-010.
- Release identity: React 0.4.280 / 2026.10.03.358; public storefront 0.16.32 / 2026.10.03.073.

Verification:
- Live data check for saas-test-shop:
  - tenant.name = ร้านทดสอบ SaaS
  - Admin settings/store.shopName = ตั่วเฮียอาหารอีสาน
- node --check public/assets/js/public-tenant-resolver.js PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- npm run build:react PASS.
- Generated React build contract PASS for 2026.10.03.358, bundle /react/assets/index-Dv9vHDtl.js.
- git diff --check PASS.
- Hosting-only deploy to Firebase project chat-45754 / target foodapp succeeded.
- Post-deploy production check of /s/saas-test-shop/delivery:
  - unavailable state rendered
  - displayed storeName = ตั่วเฮียอาหารอีสาน
  - heading = ร้านไม่พร้อมให้บริการ
  - Production public Build = 2026.10.03.073
  - deployed resolver contains direct settings/store.shopName read.

Deploy state:
- Hosting deployed successfully.
- No Functions, Firestore Rules, or Storage Rules deployed.
- Not committed, not pushed, and not merged.

---

## 2026-10-03 — Lalamove completion closes Cashier/Kitchen correctly

Issue:
- A Delivery order could have lalamoveOrderStatus=COMPLETED while local status remained ready.
- That left the same fulfilled order visible in both Cashier and Kitchen.
- Manual Lalamove refresh updated provider fields but did not canonicalize the local operational status.
- The webhook also incorrectly treated COD delivery completion as merchant payment settlement.

Fix:
- Added functions/lalamove-order-lifecycle.js as the shared completion policy for refresh + webhook.
- Prepaid/paid Lalamove COMPLETED:
  - local status -> paid
  - paymentStatus stays paid
  - completedAt + lalamoveCompletedAt are recorded
- COD Lalamove COMPLETED:
  - local fulfillment status -> completed
  - paymentStatus/paidAt are NOT changed
  - completedAt + lalamoveCompletedAt + lalamoveCodDeliveryCompletedAt are recorded
  - lalamoveCodSettlementStatus defaults to pending
- This separates delivery fulfillment from COD remittance/settlement.
- refreshTenantLalamoveDispatch repairs an already-persisted COMPLETED order before checking live credentials or calling Lalamove again.
- Duplicate/stale webhook events can repair an old COMPLETED record idempotently.
- Cashier and Kitchen both hide Lalamove COMPLETED records immediately even if an old document is still stale.
- Cashier/Kitchen also trigger silent backend repair for stale COMPLETED records.
- Order notifier now treats paid/completed as terminal.

Regression coverage:
- Prepaid completion closes to paid.
- COD completion closes fulfillment to completed without adding paymentStatus=paid or paidAt.
- Unexpected unpaid non-COD completion is not financially closed.
- Stale completion repair detection is covered.
- Cashier/Kitchen stale-completed filters and repair callables are contract-protected.

Release / deploy:
- Final React release: 0.4.280 / 2026.10.03.360.
- Final public release: 0.16.32 / 2026.10.03.075.
- Generated bundle: /react/assets/index-BIzLSVPo.js.
- placeTenantLalamoveDispatch, refreshTenantLalamoveDispatch and lalamoveWebhook were deployed.
- refreshTenantLalamoveDispatch was redeployed after adding persisted-status self-repair.
- Hosting target foodapp was deployed with Build 2026.10.03.360.
- No Firestore Rules or Storage Rules were deployed.

Production verification:
- Target Lalamove order 3597155702936359090 no longer appears on /cashier or /kitchen.
- Canonical Firestore state for that PromptPay order is status=paid, paymentStatus=paid, lalamoveOrderStatus=COMPLETED.
- completedAt and lalamoveCompletedAt are both populated.
- Not committed, not pushed, and not merged.

---

## 2026-10-03 — Quick Order payment button icon spacing/alignment

Request:
- Cash payment dialog footer buttons needed icons with a clear one-space gap before the label.
- Payment-success dialog icons were visually off-center on the Y axis.

Implementation:
- Added Bootstrap Icons to the Cash dialog footer:
  - Cancel: bi-x-circle
  - Receive cash/send to kitchen: bi-cash-coin
- Scoped Quick Order payment/footer buttons to inline-flex, align-items:center, justify-content:center, gap:7px.
- Normalized app-icon line-height, margin, align-self, and vertical-align inside the two payment dialogs.
- Kept the existing result actions:
  - New order: bi-plus-circle
  - Print receipt: bi-printer
- Added P0 regression contracts for icon presence and scoped alignment CSS.

Verification:
- test:operational PASS.
- test:react-parity PASS.
- build:react PASS.
- git diff --check PASS.
- Production bundle: /react/assets/index-D5v5DE0O.js.
- Production DOM geometry verified all four buttons at 48px height, 7px icon/text gap, and 0px icon-vs-button Y-center offset.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.361.
- Public 0.16.32 / Build 2026.10.03.076.
- Firebase Hosting target foodapp deployed successfully.
- No Functions, Firestore Rules, or Storage Rules deploy for this change.
- Not committed, not pushed, and not merged.

---

## 2026-10-03 — Quick Order menu overlay readability refinement

Request:
- Keep menu name and category aligned on the left.
- Make name/category text slightly smaller.
- Move the price badge to the right.
- Reduce price badge opacity so it covers less of the food image.

Implementation:
- Wrapped menu name/category in .quick-menu-copy.
- Changed the bottom overlay to a left-copy/right-price flex layout.
- Menu name font reduced to .74rem; category to .59rem.
- Price badge kept compact at .65rem with max-width 48%.
- Price badge background reduced to rgba(255,255,255,.76), border/shadow softened.
- Preserved two-line name clamping and single-line category truncation.
- Added P0 regression contracts for overlay structure and styling.

Verification:
- test:operational PASS.
- test:react-parity PASS.
- build:react PASS.
- git diff --check PASS.
- Production bundle: /react/assets/index-CLpfZC4G.js.
- Desktop and 390px mobile Production DOM checks confirm left copy/right price separation, no overlap, no horizontal overflow, and the expected translucent price badge.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.362.
- Public 0.16.32 / Build 2026.10.03.077.
- Firebase Hosting target foodapp deployed successfully.
- No Functions, Firestore Rules, or Storage Rules deploy for this change.
- Not committed, not pushed, and not merged.

---

## 2026-10-03 — Move Waiting Queue into Cashier Hero

Request:
- Waiting Queue does not belong inside the "เครื่องมือสั่งกลับบ้าน" action card.
- Move it beside the Hero "รับออเดอร์" action.
- Keep both Hero actions paired on mobile, even at narrow widths.

Implementation:
- Moved the Waiting Queue link from .cashier-actions into .cashier-hero-actions.
- Hero now has two primary actions:
  - รับออเดอร์ -> /cashier/quick-order
  - คิวรอโต๊ะ -> /cashier/waiting-queue
- Added .cashier-hero-queue-btn styling.
- Hero action group is nowrap with compact spacing.
- Mobile <=600px reduces action height, padding, icon gap, and font size.
- Mobile <=390px tightens the paired actions further.
- Very narrow <=360px keeps the page title full-width, then moves the paired action group to the next row while keeping both buttons side by side.
- Removed Waiting Queue from the Takeaway tools action bar.
- Added P0 regression checks preventing Waiting Queue from returning to the Takeaway tools block and protecting mobile paired action behavior.

Verification:
- test:operational PASS.
- test:react-parity PASS.
- build:react PASS.
- git diff --check PASS.
- Final Production bundle: /react/assets/index-CytYvmHS.js.
- Production viewport checks PASS at 1600, 440, 390, 360, 344 and 320 px:
  - exactly two Hero actions
  - both actions stay on the same row
  - no button overlap
  - no title/action overlap
  - title text fits
  - no horizontal document overflow
  - Waiting Queue absent from Takeaway tools card.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.364.
- Public 0.16.32 / Build 2026.10.03.079.
- Firebase Hosting target foodapp deployed successfully.
- No Functions, Firestore Rules, or Storage Rules deploy for this change.
- Not committed, not pushed, and not merged.

---

## 2026-10-03 — Compact Cashier Takeaway tools into one mobile row

Request:
- Keep the three Takeaway tool buttons on the same row as the "เครื่องมือสั่งกลับบ้าน" title.
- Reduce the height of the Takeaway tools card on mobile.

Implementation:
- Mobile <=600px now keeps .cashier-action-bar as a single flex row.
- Title/subtitle stay on the left; QR, open Takeaway and copy-link actions stay on the right.
- Mobile actions remain icon-only.
- Action buttons reduced to 40x40px with 6px gaps.
- <=390px tightens padding/gaps further.
- <=360px hides the subtitle and uses 38x38px actions to preserve one-row layout on very narrow screens.
- Added P0 regression coverage for the mobile single-row Takeaway tools layout.

Verification:
- test:operational PASS.
- test:react-parity PASS.
- build:react PASS.
- git diff --check PASS.
- Production bundle: /react/assets/index-8laqNV5Y.js.
- Production viewport checks PASS at 440, 390, 344 and 320 px:
  - exactly three Takeaway tool buttons
  - title and actions remain in the same row
  - all three buttons remain in one row
  - no title/action overlap
  - no horizontal document overflow
  - card height measured 62px at 440px, 60px at 390px, and 58px at 344/320px.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.365.
- Public 0.16.32 / Build 2026.10.03.080.
- Firebase Hosting target foodapp deployed successfully.
- No Functions, Firestore Rules, or Storage Rules deploy for this change.
- Not committed, not pushed, and not merged.

---

## 2026-10-03 — POS Customer Display PromptPay QR / timestamp / paid-state repair

Observed from Production /pos/customer-display:
- PromptPay payment area showed a broken/missing QR image.
- Footer showed "อัปเดตล่าสุด Invalid Date".
- "ขอบคุณที่ใช้บริการ" was visible while the display was still in an editing/unpaid state.

Root causes:
- Legacy POS Customer Display only supported paymentQr.qrImageUrl, while React Quick Order sends an EMV PromptPay paymentQr.payload and expects the display to render the QR locally.
- Legacy display passed a Firestore Timestamp object directly to new Date(...), producing Invalid Date.
- Legacy renderer forced paidState.hidden = false on every render.
- React counterpart also needed a stronger timestamp normalizer and an explicit paid-state gate.

Implementation:
- public/assets/js/retail-customer-display.js now imports local qrDataUrl and renders paymentQr.payload locally when qrImageUrl is absent.
- Remote qrImageUrl still remains first choice when present; image error falls back to local payload QR.
- Added timestampMillis() supporting Firestore Timestamp, seconds objects, Date, numbers and parseable date strings.
- Paid-state now displays only when snapshot.status === "paid".
- React PosCustomerDisplayPage uses the same robust timestamp normalization and paid-state condition.
- Added .paid-state[hidden]{display:none!important} to legacy and React parity Customer Display CSS.
- Bumped legacy Customer Display JS/CSS cache query to 20261003-007.
- Updated React foundation regression contracts for local QR fallback, timestamp normalization and paid-state visibility.
- Retail POS active-focus handoff updated: POS migration resumed from the existing checkpoint.

Verification:
- node --check public/assets/js/retail-customer-display.js PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- npm run build:react PASS.
- Generated React build contract PASS for 2026.10.03.366, bundle /react/assets/index-CSiB7wXc.js.
- git diff --check PASS.
- Hosting-only deploy to Firebase project chat-45754 / target foodapp succeeded.
- Production display ID quick-order-ViRMqdkm3INfLvUMcbL2Ue70IGQ2:
  - connected state renders normally
  - footer shows a valid local time, not Invalid Date
  - editing state keeps paid-state hidden with computed display:none
- Isolated copied-browser synthetic PromptPay payload check:
  - payment panel visible
  - local QR src is data:image/svg+xml
  - rendered image natural size 320x320
  - QR error hidden / empty
  - paid-state remains hidden
  - no failed/4xx resource requests during the final synthetic QR check.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.366.
- Public 0.16.32 / Build 2026.10.03.081.
- Firebase Hosting deployed successfully.
- No Functions, Firestore Rules, or Storage Rules deployed.
- Not committed, not pushed, and not merged.

---

## 2026-10-03 — POS Customer Display Laravel QR visual parity correction

Request:
- Production QR was functional but did not visually match Laravel MASTER.
- User supplied side-by-side screenshots and required the Firebase POS Customer Display to match the Laravel presentation.

Correction:
- The previous assumption that the thank-you strip should appear only after paid was incorrect for MASTER parity.
- Laravel keeps the thank-you strip visible while the live PromptPay QR is displayed.
- The legacy Customer Display also lacked the Laravel/React total-summary wrapper and QR responsive/consistency layers.

Implementation:
- Added the Thai QR Payment header artwork, PromptPay logo, and centered Thai QR mark around the live QR.
- Added total-summary markup to compact the checkout totals like MASTER.
- Loaded retail-customer-display-responsive.css and retail-customer-display-qr-consistency.css on legacy /pos/customer-display.
- Kept local paymentQr.payload rendering and robust Firestore timestamp normalization from the prior repair.
- Restored the visible thank-you strip in both legacy and React Customer Display implementations.
- Added regression contracts for MASTER QR frame, total-summary, responsive layers, and visible thank-you strip.

Verification / deploy:
- operational + full React parity suites PASS; generated React build contract PASS.
- Final React 0.4.280 / Build 2026.10.03.368; public 0.16.32 / Build 2026.10.03.083.
- Hosting-only deploy completed successfully; no Functions/Rules/Storage deployment.
- Production display quick-order-ViRMqdkm3INfLvUMcbL2Ue70IGQ2: total 240.00, branded QR renders at 320x320 source, Thai QR/PromptPay/center-mark present, thank-you strip visible, no Invalid Date, no 4xx assets.
- 1698x800 viewport parity check produced a 176px branded QR frame, matching the compact Laravel desktop/laptop scale.
- Not committed, not pushed, not merged.

---

## 2026-10-03 — POS Customer Display final Laravel header/language/thank-you parity

Request:
- Fix the remaining differences against Laravel MASTER:
  1. lower-left/lower-right radius of the "ขอบคุณที่ใช้บริการ" strip
  2. language menu must expose all 5 system languages, not only Thai/English
  3. top-right Fullscreen and Pair-device controls must be icon-only

Root causes:
- The final customer-display consistency layer still inherited older thank-you shape rules.
- public/assets/js/retail-pos-i18n-bootstrap.js hard-coded only th/en menu entries and only translated DOM text when locale=en, even though i18n.js already supports th/en/my/lo/km.
- The legacy/React customer-display Fullscreen and Pair-device controls still rendered visible text on desktop.

Implementation:
- Expanded public/assets/js/retail-pos-translations.js to th/en/my/lo/km for all 20 existing POS namespaces, sourcing my/lo/km from React parity translations.
- Static POS i18n bootstrap now exposes ไทย / English / မြန်မာ / ລາວ / ខ្មែរ and translates any non-Thai locale.
- Fullscreen and Pair-device controls are icon-only in both legacy Customer Display and React PosCustomerDisplayPage while retaining aria-label/title accessibility.
- Final Customer Display consistency CSS fixes Fullscreen/Pair-device control sizing to circles and forces the thank-you strip to 14px rounded corners on all sides.
- Customer Display asset cache query advanced to 20261003-010.

Verification:
- node --check for retail-customer-display.js, retail-pos-i18n-bootstrap.js and retail-pos-translations.js PASS.
- test:operational PASS.
- test:react-parity PASS.
- build:react PASS.
- git diff --check PASS.
- Production locale verification PASS for th/en/my/lo/km; each locale changed the visible Customer Display title/strings and marked the correct dropdown option.
- Production dropdown contains exactly 5 locales in order th,en,my,lo,km.
- Production Fullscreen and Pair-device buttons have no visible text; both are square/circular icon controls (38x38 desktop), locale trigger 42x42.
- Production thank-you strip computed bottom-left and bottom-right radii are 14px; at 1698x956 it is fully inside the total card and visible.
- No 4xx/failed resources in the locale verification run.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.369.
- Public 0.16.32 / Build 2026.10.03.084.
- React bundle /react/assets/index-wa8Ll_vj.js.
- Firebase Hosting target foodapp deployed successfully.
- No Functions, Firestore Rules, or Storage Rules deployed.
- Not committed, not pushed, and not merged.

---

## 2026-10-03 — Retail POS React migration phase 1: User Profile shell

Direction:
- Retail POS migration resumed.
- For Retail POS specifically, the existing production HTML + CSS + JavaScript UI/behavior is the migration MASTER.
- The migration changes implementation to React without redesigning the current POS appearance or behavior.

Scope:
- Shared Retail POS User Profile block inside the POS navigation drawer.

Findings:
- Legacy POS renders the profile as icon -> session user name -> role name + email inside .pos-menu-user.
- React PosNavigation already had similar markup, but it read primarily from the global Auth profile rather than the Retail POS session.
- React PosProductsPage additionally rendered the global UserMenu, creating a profile/menu surface that does not exist in the legacy POS.
- React PosCatalogPage also rendered the global UserMenu although the legacy Catalog supporting header has only Back + locale controls.

Implementation:
- Added getRetailPosSession() to the React Retail POS session module.
- Added dedicated React PosUserProfile component using the exact legacy POS classes and DOM order.
- PosNavigation now resolves the Retail POS session first for name/email/role and falls back to the global Auth profile only when session fields are absent.
- PosProductsPage no longer renders the global UserMenu; it keeps PosNavigation + LocaleSwitcher like legacy Products.
- PosCatalogPage no longer renders the global UserMenu; it keeps Back + LocaleSwitcher like the legacy Catalog support page.
- Added React foundation regression coverage for session-backed POS profile structure and to prevent global UserMenu from returning to POS Products/Catalog.

Important files:
- react-app/src/auth/retailPosSession.js
- react-app/src/components/PosUserProfile.jsx
- react-app/src/components/PosNavigation.jsx
- react-app/src/pages/PosProductsPage.jsx
- react-app/src/pages/PosCatalogPage.jsx
- tools/react-foundation-contract.mjs

Verification:
- npm run test:react-foundation PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- npm run build:react PASS.
- Generated React build contract PASS for 2026.10.03.370, bundle /react/assets/index-pHPpivGi.js.
- git diff --check PASS.
- Legacy canonical /pos intentionally remains unchanged at this phase; no POS canonical cutover was performed yet.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.370.
- Public 0.16.32 / Build 2026.10.03.085.
- Firebase Hosting target foodapp deployed successfully.
- No Functions, Firestore Rules, or Storage Rules deployed.
- Not committed, not pushed, and not merged.

---

## 2026-10-03 — Retail POS React migration phase 2: canonical Sale page /pos

Direction:
- Retail POS current production HTML + CSS + JavaScript remains the UI/behavior MASTER.
- Migrate one canonical POS menu at a time without redesign.
- This phase cuts over only the Sale root /pos. All POS subroutes remain legacy until their own migration phase.

Legacy inventory / parity:
- Archived the pre-cutover public/pos/index.html as tests/fixtures/retail-pos-legacy/pos-index.html so future React work can continue to compare against the exact legacy Sale markup.
- Legacy Sale root has 32 IDs; React PosPage contains every legacy ID, with additional features that correspond to the existing runtime enhancement scripts (catalog tabs, scanner, customer/loyalty, PromptPay, etc.).
- Products, Sales, Customer Display, Login and every other existing /pos/* directory remain legacy HTML/JS files.

Access/session corrections:
- React POS root now uses the Retail POS session profile when available and global Auth profile as fallback.
- Removed hard-coded owner/admin/manager/cashier root-role gating so custom/stock POS roles follow the legacy permission model.
- Root access checks pos.sale permission and uses firstAllowedPosPage() for users whose first allowed menu is another POS page.
- Permission redirects use full location.replace() so they land on still-legacy POS subroutes instead of React Router accidentally rendering a not-yet-cut-over menu.
- Unauthenticated root redirects into the POS login flow with next=/pos.
- React POS logout returns to /pos/login/ like the legacy navigation.

Canonical cutover:
- tools/sync-react-legacy-entrypoints.py now syncs only public/pos/index.html into the React shell.
- Existing concrete files such as public/pos/products/index.html, sales/index.html, customer-display/index.html, etc. remain untouched and continue to win as static Hosting files.
- Added no-cache header for canonical /pos.
- Generated-build regression asserts public/pos/index.html references the same current React bundle as the other canonical React entries.
- React foundation contracts protect the legacy Sale fixture, session/profile behavior, full-page permission redirects, and legacy subroute fallback.

Verification:
- test:operational PASS.
- test:react-parity PASS.
- build:react PASS.
- generated React build contract PASS for 2026.10.03.371, bundle /react/assets/index-O2_aXRTd.js.
- git diff --check PASS.
- Production /pos serves React bundle index-O2_aXRTd.js and renders productGrid, cartList, payBtn, locale and POS navigation.
- Production User Profile matches legacy DOM/text exactly: คุณพัชรินทร์ ศรีเปล่ง / เจ้าของร้าน • patcharin.sripleng@gmail.com.
- Desktop drawer geometry: panel x=1030, width=410; profile x=1052, width=366; five menu groups; current route /pos; no global UserMenu duplicate.
- Production /pos/products and /pos/sales still serve legacy HTML + retail-pos-navigation.js.
- Production /pos/customer-display remains legacy.
- Mobile checks PASS at 440, 390, 344 and 320 px with no horizontal document overflow; header/actions remain in bounds and all 5 locale options remain available.
- Firestore Listen requests reported as ERR_ABORTED only when the isolated Playwright context was intentionally closed; no application 4xx failure was observed.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.371.
- Public 0.16.32 / Build 2026.10.03.086.
- Firebase Hosting target foodapp deployed successfully.
- No Functions, Firestore Rules, or Storage Rules deployed.
- Not committed, not pushed, and not merged.
- Next POS menu migration: /pos/sales (ประวัติการขาย).

---

## 2026-10-03 — Retail POS React migration phase 3: canonical Sales history /pos/sales

Direction:
- Continue the one-menu-at-a-time Retail POS migration after canonical /pos.
- Keep the current production Retail POS HTML + CSS + JavaScript as the migration UI/behavior MASTER.
- Cut over only /pos/sales in this phase; other concrete /pos/* subroutes stay on their existing legacy entrypoints.

Legacy inventory / parity:
- Archived pre-cutover public/pos/sales/index.html as tests/fixtures/retail-pos-legacy/pos-sales-index.html before changing the canonical entrypoint.
- Preserved the legacy filter, 11 summary metrics, best-seller ranking, payment mix, sales table, CSV export, receipt dialog, reprint action, customer masking, VAT details and loyalty details.
- Preserved the complete legacy sales-history ID/action inventory with regression assertions.
- React uses the existing 5-language TH/EN/MY/LO/KM translation namespaces instead of introducing new internal identifiers.

Implementation:
- Reworked PosSalesPage to use the Retail POS session and pos.sales permission model, including /pos/login next routing and full-page first-allowed permission redirects.
- Added Firestore watchPosSales() so Sales history keeps the realtime behavior of the legacy page after initial data readiness.
- Aligned sale totals, VAT/before-VAT logic, discount totals, ranking and CSV fields with public/assets/js/retail-sales.js rather than the older React draft calculation.
- Added receipt/store/customer/VAT/loyalty rendering using the existing receipt translation keys and the same masking behavior as retail-receipt-privacy.js.
- Added React-only receipt enhancer parity CSS matching the styles previously injected by retail-sales-receipt-enhancer.js.
- tools/sync-react-legacy-entrypoints.py now syncs public/pos/sales/index.html to the current React shell while leaving all other not-yet-migrated POS subroutes untouched.
- Added no-cache Hosting headers for /pos/sales and /pos/sales/**.
- Generated-build contract now requires /pos and /pos/sales to reference the same current React bundle.
- React foundation contract now protects the archived Sales fixture, all legacy Sales IDs, realtime watcher, POS session/permission routing and canonical entrypoint sync.

Important files:
- react-app/src/pages/PosSalesPage.jsx
- react-app/src/data/retailPosData.js
- react-app/public/parity/css/retail-sales-react-parity.css
- tests/fixtures/retail-pos-legacy/pos-sales-index.html
- tools/sync-react-legacy-entrypoints.py
- tools/generated-react-build-contract.mjs
- tools/react-foundation-contract.mjs
- firebase.json
- react-app/src/config/release.js
- public/assets/js/app-info.js
- README.md

Verification:
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- npm run build:react PASS.
- generated React build contract PASS for React 0.4.280 / Build 2026.10.03.372 using /react/assets/index-Dm-TQAhU.js.
- git diff --check PASS.
- public/pos/sales/index.html exactly matches public/react/index.html after postbuild sync.
- TH/EN/MY/LO/KM each contain pos_sales, pos_sales_runtime and pos.receipt translation data.
- Global PlatformBrandingRuntime remains mounted: uploaded App Icon targets .brand-mark, Login Logo targets .login-logo, and favicon/apple-touch-icon are updated from Platform Branding at runtime.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.372.
- Public 0.16.32 / Build 2026.10.03.087.
- Firebase Hosting target foodapp deployed successfully from clean branch HEAD c7a5cd1f.
- Production https://penguin-food.web.app/pos/sales/ returned HTTP 200 with no-cache/no-store/must-revalidate and bundle /react/assets/index-Dm-TQAhU.js.
- No Functions, Firestore Rules, or Storage Rules were deployed.
- No merge to main.
- Next POS menu after user acceptance of /pos/sales: /pos/tax-invoices.


---

## 2026-10-03 — Retail POS React migration phase 4: canonical Tax invoice history /pos/tax-invoices

Direction:
- Continue the one-menu-at-a-time Retail POS migration after /pos/sales.
- Keep the pre-cutover production HTML/CSS/JavaScript under public/pos as the UI/behavior MASTER for this POS phase.
- Cut over only /pos/tax-invoices; remaining not-yet-migrated concrete POS subroutes stay on their legacy entrypoints.

Legacy inventory / root cause:
- The existing React PosTaxInvoicesPage draft was only a minimal list/print surface and did not cover the production tax-invoice history workflow.
- Archived pre-cutover public/pos/tax-invoices/index.html as tests/fixtures/retail-pos-legacy/pos-tax-invoices-index.html.
- The archived MASTER contains 52 DOM IDs/actions. React now preserves all 52/52 IDs under regression contract.
- Production behavior that had to be retained includes late full-tax-invoice issue from an old receipt, DBD lookup/manual fallback, buyer tax profiles, local+remote merge, sync/source filters, sync health, retry/recovery diagnostics, stale/quality review, pending-buyer edit, void, source-receipt links and print/open actions.

Implementation:
- Reworked PosTaxInvoicesPage around the Retail POS session and pos.tax_invoices permission model, including POS-login next routing, first-allowed full navigation and readiness/error overlays.
- React owns the canonical UI/state while reusing the existing production tax/offline/sync engine from /assets/js/retail-pos-full-tax-invoice.js. No Firestore collection, field, running-number, local-storage or other internal identifier was renamed.
- Remote invoices are loaded through the React Firestore data layer and merged with local pending invoices from retail_pos_tax_invoices_v1 using the same local/remote source semantics as legacy.
- Receipt search refreshes current sales before matching, then reuses the existing production createFullTaxInvoiceFromSale workflow.
- Preserved exact direct sync-filter semantics so error/pending/support/stale/review can overlap like legacy, rather than masking stale/review behind a higher-priority display state.
- Preserved legacy sync badges for failed, pending, local-only, temporary-number, stale, support-escalation and quality-review states.
- Preserved buyer-profile local/synced/pending states and performs profile sync when opening the profile dialog.
- DBD lookup has independent loading state in both issue and edit-buyer dialogs and retains the manual DataWarehouse fallback/copy path.
- Extracted the pre-cutover inline Tax Invoice History CSS into pos-tax-invoices-page.css for the React parity asset rather than redesigning the page.
- tools/sync-react-legacy-entrypoints.py now syncs public/pos/tax-invoices/index.html to the current React shell.
- Added no-cache Hosting headers for /pos/tax-invoices and /pos/tax-invoices/**.
- Generated-build and React-foundation contracts now require the canonical tax-invoice entrypoint, current bundle, pos.tax_invoices route token, legacy 52-ID inventory, session/permission flow and production tax sync/offline behavior bridge.

Important files:
- react-app/src/pages/PosTaxInvoicesPage.jsx
- react-app/public/parity/css/pos-tax-invoices-page.css
- public/react/parity/css/pos-tax-invoices-page.css
- tests/fixtures/retail-pos-legacy/pos-tax-invoices-index.html
- tools/sync-react-legacy-entrypoints.py
- tools/generated-react-build-contract.mjs
- tools/react-foundation-contract.mjs
- firebase.json
- react-app/src/config/release.js
- public/assets/js/app-info.js
- README.md

Verification:
- npm run test:operational PASS.
- npm run test:react-parity PASS, including foundation, migration, parity matrix, P0 actions, callable, tenant-access and UI-layer contracts.
- npm run build:react PASS.
- Generated React build contract PASS for React 0.4.280 / Build 2026.10.03.373 using /react/assets/index-OgvHpgF6.js.
- git diff --check PASS.
- Legacy Tax Invoice History fixture ID inventory: 52/52 present in React.
- Local built canonical /pos/tax-invoices/ returned HTTP 200 and referenced /react/assets/index-OgvHpgF6.js; the production tax engine asset returned JavaScript with create/void/retry exports present.
- Headless Chrome smoke confirmed the unauthenticated canonical route first navigates to /pos/login/?next=%2Fpos%2Ftax-invoices%2F. The subsequent POS-login-to-central-login redirect is the existing unauthenticated login flow.
- The local smoke also exposed an existing system-controls.css 404 on the login surface; it is outside this Tax Invoice History cutover and was not expanded into this phase.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.373.
- Public 0.16.32 / Build 2026.10.03.088.
- Implementation commit a1c90558 (feat: migrate POS tax invoice history to React) pushed to origin/feature/react-firebase-port before deploy.
- Firebase Hosting target foodapp deployed successfully from implementation commit a1c90558.
- Production https://penguin-food.web.app/pos/tax-invoices/ returned HTTP 200 with no-cache/no-store/must-revalidate and the expected /react/assets/index-OgvHpgF6.js bundle.
- Production tax sync/offline engine asset returned HTTP 200 with createFullTaxInvoiceFromSale, voidFullTaxInvoice, retryTaxInvoiceSync and syncPendingTaxInvoices exports present; Tax Invoice History parity CSS also returned HTTP 200.
- No Functions, Firestore Rules, or Storage Rules were deployed.
- No merge to main.
- Next POS menu after user acceptance of /pos/tax-invoices: /pos/returns.

---

## 2026-10-03 — Pause Retail POS; diagnose Revenue Share PENGUIN Wallet status

Direction:
- Retail POS work is paused at the completed /pos/tax-invoices Production checkpoint.
- Current priority is making the PENGUIN Credits for Lalamove section on /reports/revenue-share operational.

Symptom:
- Production Revenue Share shows the wallet card but labels it “PENGUIN Wallet structure not installed”, with all wallet metrics at zero and no ledger/failure rows.

Root cause:
- React RevenueShareReportPage already renders the wallet payload from getTenantRevenueShareSummary.
- Current functions/revenue-share.js already includes tenantWalletReport(), reading settings/lalamoveWallet, lalamoveWalletTransactions and lalamoveWalletTopups and returning storageReady=true plus period/top-up/ledger metrics and Lalamove failures.
- The Production getTenantRevenueShareSummary function is stale: its deployed source generation is 1789849619825406 (2026-09-20 03:26:59 Asia/Bangkok), while tenantWalletReport was introduced in commit d8c5eaf4 on 2026-09-30.
- Production therefore returns the older summary shape without wallet/lalamoveFailures. React falls back to wallet={} and correctly shows its storage-missing fallback even though Firestore does not require a pre-created table.

Verification:
- node --check functions/revenue-share.js PASS.
- npm run test:operational PASS.
- git diff --check PASS before this worklog update.
- Firebase functions:list confirms getTenantRevenueShareSummary is ACTIVE but on the older source generation; getTenantLalamoveWallet/getTenantRevenueShareAccess have newer deployed generations.
- No wallet balance, ledger or tenant credit data was fabricated or mutated during diagnosis.

Deploy / Production verification:
- User explicitly approved the targeted Function repair.
- Deployed only Cloud Function getTenantRevenueShareSummary to Firebase project chat-45754; no Hosting, Firestore Rules, Storage Rules, or other Functions were deployed.
- Deployment completed successfully on Node.js 22 Gen 2 revision gettenantrevenuesharesummary-00006-vuf.
- Production function hash is bdd8e23412e82d99658c00184861525e8640f558; source generation 1791012507355561 (2026-10-03T07:28:27.355561Z).
- Unauthenticated callable smoke returns HTTP 401 / Authentication required, confirming the new endpoint is active and enforcing auth.
- Reloaded the user's existing authenticated Chrome tab at /reports/revenue-share after deployment.
- Function logs then recorded authenticated requests at 2026-10-03T07:31:21Z and 07:31:28Z with auth=VALID and no wallet/report execution error.
- Chrome has JavaScript-from-Apple-Events and Accessibility automation disabled, so Remote could not read the rendered wallet DOM directly; backend revision/authenticated execution is verified.
- No wallet balances, top-ups, ledger entries, or tenant credit data were fabricated or modified.
- No Hosting deploy occurred, so React/Public Build numbers were intentionally not bumped.


---

## 2026-10-03 — Retail POS shared User Profile + Menu Drawer parity repair

Request / visual mismatch:
- User asked to stop advancing POS routes until the shared User Profile and POS menu drawer matched the current legacy/reference UI.
- Production PENGUIN screenshot showed the POS drawer title and user name in white, while the reference drawer shows dark text; the “กลับหน้าระบบกลาง” action also lacked its house icon.

Root cause:
- React PosNavigation rendered the drawer popover as a child of the white-text .pos-header, so generic drawer text inherited color:#fff.
- Legacy retail-pos-navigation.js appends the popover directly to document.body, so it does not inherit the POS header color.
- React kept data-pos-icon="house" on the central-home action but did not run the legacy icon enhancer for that authored React element, leaving the icon absent.

Implementation:
- PosNavigation now renders #posMenuPopover through React createPortal(..., document.body), matching the legacy DOM ownership and removing header color inheritance.
- Added the authored Bootstrap house icon with pos-context-icon / emerald tone to the central-home action.
- Added an explicit color:var(--black) safeguard to the React POS drawer panel.
- Kept Retail POS session-first name/email/role resolution, permission-aware menu groups, current-route highlighting, logout behavior, and all existing internal IDs unchanged.
- Added React foundation regression guards for body portal mounting, central-home icon parity, and explicit dark drawer text.

Verification:
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- npm run build:react PASS.
- Generated React build contract PASS for React 0.4.280 / Build 2026.10.03.374 using /react/assets/index-DEpGoUYI.js.
- git diff --check PASS.
- Intermediate pre-bump bundle generated with reused Build .373 was removed and was never deployed.
- No Functions, Firestore Rules or Storage Rules changes are required.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.374.
- Public 0.16.32 / Build 2026.10.03.089.
- Implementation commit 4a09c66c (fix: align shared POS profile and menu drawer) pushed to origin/feature/react-firebase-port before deploy.
- Firebase Hosting target foodapp deployed successfully.
- Production /pos returns HTTP 200 with no-cache/no-store/must-revalidate and the expected /react/assets/index-DEpGoUYI.js bundle.
- Production POS navigation CSS contains the explicit dark drawer text safeguard, and the bundle contains the authored house icon plus document.body portal marker.
- Reloaded the user's existing authenticated Chrome /pos tab after deployment.
- Source audit confirms React keeps the same five legacy menu groups, item labels, permission keys, icon tones, and route ordering; React uses canonical no-trailing-slash hrefs while legacy uses equivalent trailing-slash hrefs.
- No Functions, Firestore Rules or Storage Rules were deployed.
- No merge to main.


---

## 2026-10-03 — Retail POS React migration phase 5: canonical Returns /pos/returns

Direction:
- User accepted the shared POS User Profile/Menu Drawer repair and approved continuing the POS migration.
- Continue one menu at a time; current phase is /pos/returns only.
- Pre-cutover production HTML/CSS/JavaScript remains the Retail POS UI/behavior MASTER.

Legacy inventory / gaps found:
- Archived pre-cutover public/pos/returns/index.html as tests/fixtures/retail-pos-legacy/pos-returns-index.html.
- Legacy Returns contains 21 page IDs/actions; React now preserves all 21/21 under regression contract.
- The previous React draft was not parity-complete: it added a non-legacy search-mode selector, submitted VOID immediately, and omitted loyalty reversal/restore, sale refund status, audit log, return receipt/print, and camera barcode scanning.
- Legacy VOID behavior is two-step: select all remaining quantities + set original refund method/reason, then use the normal confirmation flow.
- Legacy transaction also restores stock, writes stock movements, adjusts customer loyalty + loyalty ledger, updates sale returns/refundTotal/refundStatus/status, and writes the return audit event atomically.

Implementation:
- Reworked PosReturnsPage around Retail POS session-first auth, pos.returns permission, POS-login next routing, first-allowed full navigation, and readiness/error overlays.
- Restored the single legacy search field: sale number/id plus product name/id/barcode, only sales with remaining returnable quantity, max 30 results.
- Restored legacy quantity behavior: step 0.001, clamp to remaining, select-on-focus, and Enter advances to the next quantity field.
- Restored VOID as a preparation action rather than an immediate write; final submit uses the same confirmation path and derives full VOID vs partial return from cumulative returned quantity.
- Added react-app/src/data/retailPosReturns.js to preserve the production return transaction semantics: quantity validation, stock restoration, stock movement, customer point reversal/restore, loyaltyLedger, sale refund status/status/loyalty updates, and auditLogs.
- Preserved RETURN-... versus VOID-... document prefixes used by the current production flow.
- Added logical-ID / Firestore-document-ID compatibility. React snapshots now retain _documentId and Returns uses it for legacy sale/product/customer documents whose stored logical ID differs from the Firestore document ID.
- Restored legacy loyalty preview and history adjustment visibility.
- Recreated the return receipt dialog/80 mm print surface with the legacy receipt IDs and existing retail-return-receipt.css.
- Added the legacy-style camera barcode flow with BarcodeDetector first and ZXing fallback; scanner styling is in retail-barcode-scan-tools.css.
- Thai search description, placeholder, initial prompt, and no-result copy are held to the current legacy screen while other locales use the existing five-language translation catalog.
- tools/sync-react-legacy-entrypoints.py now cuts over public/pos/returns/index.html to the React shell.
- Added no-cache Hosting headers for /pos/returns and /pos/returns/**.
- Generated-build and foundation contracts now require canonical Returns, the 21-ID legacy inventory, session/permission flow, VOID-confirm behavior, loyalty/scanner/receipt actions, transaction markers, and legacy document-ID compatibility.

Verification:
- node --check react-app/src/data/retailPosReturns.js PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS, including foundation, migration, parity matrix, P0 actions, callables, tenant access, and UI-layer contracts.
- npm run build:react PASS.
- Generated React build contract PASS for React 0.4.280 / Build 2026.10.03.375 using /react/assets/index--8wcUKVM.js.
- git diff --check PASS.
- Canonical public/pos/returns/index.html matches public/react/index.html after build.
- Legacy Returns fixture ID inventory: 21/21 present in React.
- Local headless Chrome smoke: /pos/returns/ HTTP 200, no Returns pageerror, then the expected unauthenticated redirect to /pos/login/?next=%2Fpos%2Freturns%2F.
- The existing local-login system-controls.css 404 remains outside this Returns phase and was not expanded into the migration.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.375.
- Public 0.16.32 / Build 2026.10.03.090.
- Intermediate Returns bundles generated under the already-deployed Build .374 were never deployed and were removed only when confirmed unreferenced.
- Implementation commit 29c309cf (feat: migrate POS returns to React) was pushed to origin/feature/react-firebase-port before deploy.
- Firebase Hosting target foodapp deployed successfully from implementation commit 29c309cf.
- Production https://penguin-food.web.app/pos/returns/ returned HTTP 200 with no-cache/no-store/must-revalidate and the expected /react/assets/index--8wcUKVM.js bundle.
- Production scanner parity CSS returned HTTP 200 and contains both scanner-button and camera-dialog styles.
- Opened the user's authenticated Chrome tab on canonical /pos/returns and visually verified the production header, one-field search, barcode button, search action, initial empty state, and return-history panel rendered correctly without a white page or layout break.
- The temporary Production verification query was removed afterward, leaving the tab on canonical /pos/returns.
- No Functions, Firestore Rules, or Storage Rules were deployed.
- No merge to main.
- After user acceptance of /pos/returns, the next sales-group POS menu is /pos/shifts.


---

## 2026-10-03 — Retail POS visual parity pass: Sales + Tax Invoice History + Returns

Request:
- User explicitly asked to fix visual parity before continuing POS route migration and authorized direct fixes without additional confirmation.
- Side-by-side screenshots showed React behavior was working but appearance still differed from the current task2 Retail POS reference, including inconsistent floating developer/version control.

Reference / root causes:
- Current task2 screenshots and the Laravel/POS source on /Users/natchanonsripleng/Desktop/Sites/food-order-app-php80 are the visual MASTER for this pass.
- The archived pre-cutover fixture is not sufficient for every visual detail because task2 has later enhancements, especially Returns search modes and semantic icon badges.
- Legacy task2 automatically decorates controls/headings through retail-pos-icons.js imported by retail-pos-navigation.js. React does not run that DOM enhancer, so authored React controls were missing the same semantic icons.
- Returns did not load app-version-badge-runtime.css even though AppDeveloperPanel was mounted, causing the floating developer/version button to disappear on that page.
- React Returns had dropped the current task2 search-mode selector and had replaced mode-specific copy/filtering with one generic search behavior.
- React Tax Invoice History contained an extra React-only Back POS action in the header and retained the older narrow 1180px shell while the supplied task2 reference uses the available desktop width.

Implementation:
- Sales:
  - Restored calendar3/blue icons on Today and This Month.
  - Restored x-circle/rose icon on All.
  - Restored cart3/emerald icon on Best Sellers and sales-list headings.
  - Restored credit-card/blue icon on Payment Mix.
- Tax Invoice History:
  - Removed the extra Back POS header action so header actions match the supplied task2 reference: Refresh + locale + POS menu.
  - Restored semantic icon badges for issue heading, sync/source filter chips, sync-health chips, and buyer/company card heading.
  - Added supporting-header/supporting-page attributes used by the POS responsive system.
  - Added a task2 visual override so the desktop Tax Invoice History shell uses the available viewport width instead of the old 1180px cap.
- Returns:
  - Restored search selector with Receipt/Bill Number, Product Name, and Barcode modes using the existing five-language translation catalog.
  - Restored task2 mode-specific placeholder/prompt/no-result copy and filtering semantics, including exact-first receipt matching and max 30 results.
  - Barcode camera scans switch to Barcode mode before applying the scanned value.
  - Restored receipt/green search heading icon and arrow-counterclockwise/rose history heading icon.
  - Added app-version-badge-runtime.css so the same floating developer/version control is present consistently.
- Updated React foundation visual contracts so these visual decisions cannot silently regress.

Verification before commit/deploy:
- npm run test:react-foundation PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS, including migration, parity matrix, P0 actions, callables, tenant access, and UI-layer contracts.
- npm run build:react PASS.
- Generated React build contract PASS for React 0.4.280 / Build 2026.10.03.376 using /react/assets/index-D1nG9iYR.js.
- git diff --check PASS.
- Canonical /pos/sales, /pos/tax-invoices, and /pos/returns entrypoints all match the current React shell after build.
- Generated Tax Invoice History CSS contains the full-width task2 override.
- Sales, Tax Invoice History, and Returns all mount AppDeveloperPanel; Returns now also loads its required floating-control CSS.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.376.
- Public 0.16.32 / Build 2026.10.03.091.
- Implementation commit b9e984cb (fix: align POS sales tax and returns visuals) was pushed to origin/feature/react-firebase-port before deploy.
- Firebase Hosting target foodapp deployed successfully; no Functions, Firestore Rules, or Storage Rules were deployed.
- Production /pos/sales, /pos/tax-invoices, and /pos/returns each returned HTTP 200 with no-cache/no-store/must-revalidate and the expected /react/assets/index-D1nG9iYR.js bundle.
- Production visual verification in the user's authenticated Chrome session:
  - Sales: Today/This Month/All semantic icons render; Best Sellers and Payment Mix heading badges render; floating developer/version dot is present.
  - Tax Invoice History: extra Back POS action is gone; desktop content uses the task2 full width; filter/health/header card icons render; floating developer/version dot is present.
  - Returns: Receipt/Bill Number search mode selector is restored with task2 receipt-mode copy; section icons render; floating developer/version dot is present.
- Initial screenshots taken during readiness loading were discarded and not used for visual acceptance; final screenshots were captured only after the authenticated pages finished rendering.
- Canonical URLs were left without verification query parameters.
- Do not proceed to /pos/shifts until the user has had a chance to inspect this visual-parity Production release.


---

## 2026-10-03 — Retail POS React migration phase 6: canonical Staff Shifts /pos/shifts

Direction / reference:
- User accepted the Sales/Tax/Returns visual-parity release and asked to continue directly.
- Current task2 page at https://task2.dev2.zmartb.co/pos/shifts/ and its Laravel/POS source under /Users/natchanonsripleng/Desktop/Sites/food-order-app-php80 are the visual/behavior reference for this phase.
- Captured authenticated before-cutover screenshots of task2 and PENGUIN shifts. The legacy PENGUIN screen was already visually close to task2, so the React migration must preserve that screen rather than redesign it.
- Archived pre-cutover public/pos/shifts/index.html as tests/fixtures/retail-pos-legacy/pos-shifts-index.html.

Gaps found in the previous React draft:
- PosShiftsPage was only 29 lines and did not preserve the legacy 24-ID DOM/action inventory.
- It used page-level pos.shifts permission only; task2 has five action permissions: pos.shifts.open, pos.shifts.close, pos.shifts.view_amount, pos.shifts.view_history, pos.shifts.clear_history.
- It wrote shifts directly to Firestore and lacked task2's local pending/offline retry behavior.
- Its displayed copy differed from task2 (for example “กะพนักงาน”, “เปิดกะพนักงาน”, “กะที่กำลังเปิด”) rather than the five-language pos_operations.shifts catalog.
- Shift sales totals only matched explicit shiftId and subtracted refund totals. task2 also includes untagged sales inside the shift time window and uses gross sale totals.
- History field names differed between Firebase React draft and legacy/task2 (totalSales/closingCash versus salesTotal/actualCash), risking older shift rows displaying zero.
- Direct open used one deterministic ID per user/terminal/day, which could overwrite/reuse a closed shift when the same cashier opened another shift on the same day.

Implementation:
- Rebuilt PosShiftsPage around Retail POS session-first auth, canonical POS-login next routing, first-allowed full-page redirect, PageReadyOverlay, LocaleSwitcher, PosNavigation, and AppDeveloperPanel.
- Preserved all 24/24 legacy IDs including noActiveShift, activeShiftPanel, openShiftForm, closeShiftForm, amount/stat IDs, shiftHistoryBody, clearShiftHistory, and toast.
- Restored task2 visual copy/classes and semantic icons:
  - clock-history/violet shift headings,
  - play-circle/emerald Open Shift action,
  - bar-chart-line/indigo History heading,
  - rose Close/Clear actions,
  - existing retail-shifts.css responsive/mobile layout,
  - app-version-badge-runtime.css floating developer/version control.
- Restored the five granular shift permissions. Built-in owner/admin/manager/cashier fallback semantics match current task2; if stored role data already contains granular shift permissions, those explicit permissions win.
- Sales totals now match task2: explicit shiftId first, then untagged sales whose createdAt is between shift open/close times, with gross sale totals split into cash versus non-cash.
- Amount values and history amount columns are hidden when pos.shifts.view_amount is absent; history is hidden without pos.shifts.view_history; Open/Close forms are disabled without their corresponding permissions; Clear History is hidden without pos.shifts.clear_history.
- Added react-app/src/data/retailPosShifts.js:
  - local active/history keys remain retail_pos_active_shift_v1 and retail_pos_shift_history_v1,
  - pending operations use retail_pos_shift_sync_queue_v1,
  - local open/close state is written before remote synchronization,
  - online retry queue uses pending/syncing/conflict states and retail:shift-sync events,
  - remote shift snapshots are overlaid with pending local operations,
  - when multiple shifts are open remotely, the current user's open shift is selected before any other shift, matching task2 semantics.
- Shared retailPosData now:
  - checks local active/pending-close state before returning the active shift to the Sale page,
  - exposes watchPosShifts,
  - supports exact shiftId/openedAt and closedAt for idempotent offline replay,
  - uses unique random shift IDs for multiple same-day shifts,
  - stores legacy-compatible aliases (salesTotal/actualCash/cashSales/transferSales) alongside React fields.
- Canonical /pos/shifts is added to the React postbuild sync and Hosting no-cache headers.
- Generated build and foundation contracts now require the canonical shifts bundle, 24-ID fixture inventory, five granular permissions, task2 icon/floating parity, gross/time-fallback totals, offline queue markers, and shared active/pending-close compatibility.

Verification before commit/deploy:
- node --check react-app/src/data/retailPosData.js PASS.
- node --check react-app/src/data/retailPosShifts.js PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS, including foundation, migration, parity matrix, P0 actions, callables, tenant access, and UI-layer contracts.
- npm run build:react PASS.
- Generated React build contract PASS for React 0.4.280 / Build 2026.10.03.377 using /react/assets/index-CmuUq0DB.js.
- git diff --check PASS.
- Canonical public/pos/shifts/index.html matches public/react/index.html after build.
- Legacy Shifts fixture ID inventory: 24/24 present in React.
- Local headless Chrome smoke: /pos/shifts/ HTTP 200, no pageerror, then expected unauthenticated routing through /pos/login/?next=%2Fpos%2Fshifts%2F.
- Existing local-login system-controls.css 404 remains outside this Shifts phase.
- Intermediate .376/.377 bundles created before final code were removed only after confirming they were unreferenced and were never deployed.

Release / deploy / post-deploy visual correction:
- Initial Shifts implementation commit 52191579 (feat: migrate POS staff shifts to React) was pushed to origin/feature/react-firebase-port.
- Firebase Hosting target foodapp deployed Build 2026.10.03.377 / Public Build 2026.10.03.092 successfully; no Functions, Firestore Rules, or Storage Rules were deployed.
- Production /pos/shifts returned HTTP 200 with no-cache/no-store/must-revalidate and /react/assets/index-CmuUq0DB.js.
- Read-only authenticated Production screenshot confirmed the React page rendered the task2 layout/icons/floating developer control without opening, closing, or clearing a real shift.
- That screenshot exposed two remaining task2 visual differences:
  - React history timestamps used the short Buddhist year (for example 16/7/69) while task2 uses the full Buddhist year (for example 27/7/2569 22:29:37).
  - task2 form-validation-ui marks valid required shift fields with green border/background/shadow; the authored React controls stayed neutral because React does not run that DOM enhancer.
- Corrective implementation:
  - PosShiftsPage now formats shift metadata/history with toLocaleString("th-TH") and numeric full year/month/day/time.
  - Required cashier/terminal/opening-cash/actual-cash controls author data-validation-state="valid" when their current value is valid.
  - retail-shifts.css now carries the same valid-field green visual treatment used by task2 form-validation-ui.
  - React foundation contract locks both full-year formatting and valid-field styling.
- Corrective release: React 0.4.280 / Build 2026.10.03.378; Public 0.16.32 / Build 2026.10.03.093; generated bundle /react/assets/index-Cv45MZfk.js.
- Full operational/parity/build/generated-contract/git-diff gates PASS for the corrective Build .378.
- Corrective commit e4d51e06 (fix: finalize POS shifts visual parity) was pushed to origin/feature/react-firebase-port before deploy.
- Firebase Hosting target foodapp deployed Build .378 successfully; no Functions, Firestore Rules, or Storage Rules were deployed.
- Production canonical /pos/shifts resolves to /react/assets/index-Cv45MZfk.js with no-cache/no-store/must-revalidate.
- Production retail-shifts.css contains the task2 valid-field green border/background rules and the Production bundle contains the th-TH formatter marker used for full Buddhist-year timestamps.
- A final .378 screen capture could not be used because macOS locked the display during capture; the resulting image was the Lock Screen. No false visual-verification claim was recorded. The .377 authenticated screenshot had already verified the full Shifts layout/icons/floating control; .378 changes only the two source/CSS-verified visual deltas above.
- Chrome tab was returned to canonical https://penguin-food.web.app/pos/shifts without a verification query.
- Production verification remained read-only: no real shift was opened, closed, or history-cleared for testing.
- No merge to main.


---

## 2026-10-03 — Retail POS confirmation-dialog parity: remove browser-native confirm

Request / issue:
- User compared PENGUIN /pos/shifts with task2 and showed that PENGUIN still opened Chrome's native confirm banner for “ล้างประวัติ”, while task2 uses the centered app warning dialog with Cancel/Confirm actions.
- This was a migration parity miss because the Shifts React page still called window.confirm().

Audit:
- Scanned canonical React POS pages already cut over to Production.
- Native confirmation remained in three canonical React pages:
  - PosShiftsPage: clear shift history.
  - PosReturnsPage: return/VOID confirmation.
  - PosTaxInvoicesPage: delete tax-buyer profile.
- PosCustomersPage and PosSuppliersPage also contain native confirm in their draft React implementations, but those pages are not part of the current canonical React cutover, so they were intentionally left for their own migration phase.

Implementation:
- Shifts, Returns, and Tax Invoice History now import the shared React sweetConfirm helper and load sweet-dialog.css.
- Confirmation dialogs use the existing five-language shared keys:
  - shared.dialog.confirm_title
  - shared.actions.confirm
  - shared.actions.cancel
- All three use warning type so the icon, centered card, overlay, and action order match the task2 dialog.
- Shifts clear-history action is now async and performs no destructive change unless sweetConfirm resolves true.
- Returns return/VOID submit waits for sweetConfirm before writing the return transaction.
- Tax buyer-profile delete waits for sweetConfirm before deleting/syncing the profile.
- Removed all window.confirm/native confirm calls from these three canonical React Production pages.
- React foundation contract now prevents native-confirm regression on all three pages and requires the shared sweet-dialog import/CSS/title behavior.
- Existing UI-layer contract remains Toast 2147483647 > Dialog 2147483600 > Modal 2147483000.

Verification before deploy:
- Native confirm grep for canonical React Shifts/Returns/Tax Invoice History: no matches.
- npm run test:react-foundation PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS, including UI-layer contract.
- npm run build:react PASS.
- Generated React build contract PASS for React 0.4.280 / Build 2026.10.03.379 using /react/assets/index-f9vG_Kov.js.
- git diff --check PASS.
- An intermediate Build .378 bundle created during the first compile was removed only after confirming it was unreferenced and was never deployed.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.379.
- Public 0.16.32 / Build 2026.10.03.094.
- Implementation commit f062ad45 (fix: replace POS native confirms with app dialog) was pushed to origin/feature/react-firebase-port before deploy.
- Firebase Hosting target foodapp deployed successfully; no Functions, Firestore Rules, or Storage Rules were deployed.
- Production /pos/shifts, /pos/returns, and /pos/tax-invoices each return HTTP 200 with no-cache/no-store/must-revalidate and the expected /react/assets/index-f9vG_Kov.js bundle.
- Production sweet-dialog.css returns HTTP 200, and the deployed bundle contains the shared dialog path while containing no window.confirm() call for these canonical pages.
- A safe UI verification attempt was made by opening the Shifts page and intending to click Clear History then Cancel only. macOS switched the active application to Edge during coordinate automation, so the click did not occur in PENGUIN and no Production data was changed. Coordinate clicking was not retried.
- Final verification therefore relies on the deployed bundle/CSS plus the regression contract; no destructive Production action was executed.
- No merge to main.


---

## 2026-10-03 — Global Toast alert policy: top layer + 75vh + status icons

User rule:
- Toast alert must always be the highest UI layer.
- Toast horizontal center is the viewport center.
- Toast vertical center is the midpoint from viewport center to viewport bottom, i.e. exactly 75vh.
- Success Toast must show a green circle-check icon, a visual space, then the message.
- Unsuccessful/error Toast must show a red circle-x icon, a visual space, then the message.

Root cause / audit:
- UI-layer order already enforced Toast > Sweet Dialog > Modal through ui-layer-stack.css and toast-top-layer.js.
- Toast presentation was inconsistent:
  - legacy/page CSS still used 68vh and mobile 66vh,
  - toast-system.css used a bottom:25vh anchor which placed the Toast edge rather than its center at the requested point,
  - Shifts and Returns rendered simple text-only .toast nodes,
  - most imperative .app-toast helpers already rendered check-circle/x-circle icons.
- Because Laravel parity CSS can be re-synced later, changing only copied parity files would risk silently restoring the old position.

Implementation:
- Added React-owned global stylesheet react-app/public/parity/css/toast-global-policy.css and load it globally from react-app/index.html after ui-layer-stack.css.
- The policy intentionally remains outside tools/sync-react-parity-assets.py so future Laravel parity sync cannot overwrite it.
- The global selector has enough specificity to override older app.css/retail-pos.css 66vh/68vh declarations, including !important variants.
- Every React Toast selector (.app-toast, .toast, [data-app-toast], [data-ui-layer=toast]) is fixed at left:50%, top:75vh and shown with translate(-50%,-50%).
- Global Toast z-index remains --ui-layer-toast-z = 2147483647, above shared dialog and modal layers.
- Toast width is content-sized with a safe 560px viewport-aware maximum and retains the dark surface.
- Success icon color: #22c55e; error icon color: #ef4444; icon/message gap: 8px.
- Mobile uses the same exact 75vh center instead of the previous 66vh/24vh variants.
- PosShiftsPage now renders the shared icon + message Toast structure and tracks toastType.
- PosReturnsPage now renders the same structure; unsupported-camera and camera-open-failure Toasts are explicitly error type so they use the red x-circle.
- docs/UI_LAYER_POLICY.md now records the positioning and icon rule as a mandatory global UI policy.
- UI-layer and React foundation contracts lock the new rule, and generated build contract requires the built Toast policy asset/link.

Verification:
- Browser geometry smoke with a 1600x900 viewport:
  - success Toast centerX = 800,
  - centerY = 675 = 75vh,
  - z-index = 2147483647,
  - success icon color = rgb(34, 197, 94),
  - error icon color = rgb(239, 68, 68),
  - error icon class contains bi-x-circle,
  - gap = 8px,
  - PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS, including UI layer contract Toast 2147483647 > Dialog 2147483600 > Modal 2147483000.
- npm run build:react PASS.
- Generated React build contract PASS for React 0.4.280 / Build 2026.10.03.380 using /react/assets/index-DCJz_imo.js.
- git diff --check PASS.

Release / deploy:
- React 0.4.280 / Build 2026.10.03.380.
- Public 0.16.32 / Build 2026.10.03.095.
- Implementation commit 29d5360e (fix: enforce global toast alert policy) was pushed to origin/feature/react-firebase-port before deploy.
- Firebase Hosting target foodapp deployed successfully; no Functions, Firestore Rules, or Storage Rules were deployed.
- Production /pos/shifts, /pos/returns, and /pos return HTTP 200 with no-cache/no-store/must-revalidate and /react/assets/index-DCJz_imo.js.
- Production shells load /react/parity/css/toast-global-policy.css and the asset returns HTTP 200 with the required 75vh, green, red, and 8px-gap rules.
- Production CSS browser geometry smoke (1600x900 viewport) PASS:
  - center = 800 x 675 exactly,
  - z-index = 2147483647,
  - success icon = rgb(34,197,94),
  - error icon = rgb(239,68,68),
  - gap = 8px.
- No merge to main.


---

## 2026-10-03 — Retail POS remaining-route audit after global Toast release

Request:
- Continue immediately with the next Retail POS migration task after Build 2026.10.03.380.

Audit result:
- Canonical React routes already in Production, in POS menu order:
  - /pos
  - /pos/sales
  - /pos/tax-invoices
  - /pos/returns
  - /pos/shifts
- The next menu route still served by the current legacy static implementation is /pos/products (สินค้าและสต็อก).
- Remaining menu routes after Products are /pos/stock-movements, /pos/stock-counts, /pos/purchases, /pos/payables, /pos/suppliers, /pos/customers, /pos/settings, /pos/backup, and /pos/users.
- React route components already exist for all of those paths, but most later components are still small migration drafts; existence of a React route is not considered a completed canonical cutover.
- Current /pos/products legacy page has 60 stable IDs and a substantial product/category/stock/sort feature surface. Existing PosProductsPage is also substantial but currently preserves only 12/60 legacy IDs, so it must not be cut over without a full parity pass.
- Authenticated screenshots of current PENGUIN legacy /pos/products and task2 /pos/products were captured before migration. Their visible desktop layout is already closely aligned; data counts differ between environments as expected and are not a parity defect.

Decision:
- Next migration target is canonical /pos/products, following the actual POS navigation order.
- Preserve current production/task2 UI/behavior rather than redesigning.
- Archive the pre-cutover PENGUIN legacy HTML fixture before changing the canonical entrypoint.
- Compare all product/category/stock/sort permissions, actions, dialogs, barcode behavior, responsive behavior, and 60-ID inventory before cutover.
- No code cutover/deploy was performed by this audit entry.


---

## 2026-10-04 — Retail POS React migration phase 7: canonical Products /pos/products

Direction:
- Continued immediately after the global Toast release.
- Audited remaining POS menu routes and selected /pos/products as the next canonical migration target because it is the first still-legacy route in the actual POS navigation order.
- Preserved the uncommitted Products migration work already present in the working tree; no reset/clean/discard was used.
- Current production legacy /pos/products remains the UI/behavior MASTER for this route.

Legacy inventory / parity:
- Archived pre-cutover public/pos/products/index.html as tests/fixtures/retail-pos-legacy/pos-products-index.html.
- Legacy Products page exposes 60 stable IDs across:
  - product stats/list/filter/pagination,
  - category manager,
  - category pagination,
  - category/product sort manager,
  - stock movement history,
  - product/category/stock dialogs,
  - Toast.
- React Products now preserves all 60/60 legacy IDs.
- Granular permissions preserved:
  - pos.products.create
  - pos.products.edit
  - pos.products.delete
  - pos.products.adjust_stock
  - pos.products.view_cost
  - pos.products.clear_history
- Retail POS session-first auth, /pos/login next routing, first-allowed full navigation, LocaleSwitcher, PosNavigation, and AppDeveloperPanel are preserved.

Behavior/data implementation:
- Realtime Firestore watchers added/preserved for products, categories, stock movements, and catalog-order settings.
- Category manager preserves search/status/sort/page-size/pagination, derived categories, create/edit/delete, aliases, rename migration, reserved-name validation, duplicate validation, and catalog-order rename migration.
- Product form preserves product code/barcode/name/price/unit/stock/min-stock plus merchandising fields, image upload/URL/removal, cost visibility permission, category picker/create-category flow, sort order, and show-on-POS.
- Stock adjustment remains transactional and writes stock movement records.
- Product/category delete and clear-history actions use the shared centered sweet confirmation dialog; no browser-native confirm is used.
- Barcode scanning is rendered in React and supports native BarcodeDetector first with ZXing fallback, scan feedback, camera cleanup, and typed success/error Toasts.
- Sortable category/product behavior matches the current legacy MASTER values:
  - animation 180
  - forceFallback true
  - fallbackOnBody true
  - fallbackTolerance 3
  - delay 120
  - delayOnTouchOnly true
  - touchStartThreshold 4
- Typed Toast + message structure and global Toast policy are preserved.

Legacy Firestore document compatibility:
- Product normalization deduplicates logical product IDs while retaining _documentId/_documentIds.
- Product edit writes the canonical logical-ID document and removes old duplicate legacy document IDs in the same batch.
- Product delete removes all known duplicate document IDs.
- Stock adjustment accepts the normalized product object and writes to _documentId when present instead of assuming logical product.id is the Firestore document ID.
- Product sort-order writes also use _documentId when present.
- This closes the edge case where old data could be readable but stock/sort writes targeted a non-existent canonical document.

Canonical cutover:
- tools/sync-react-legacy-entrypoints.py now syncs public/pos/products/index.html from the React shell.
- firebase.json adds no-cache/no-store/must-revalidate headers for /pos/products and /pos/products/**.
- Generated build contract requires canonical /pos/products to use the current React bundle and contain pos.products.
- React foundation contract locks:
  - 60-ID fixture parity,
  - session/page permissions,
  - six granular permissions,
  - current Sortable profile,
  - realtime watchers,
  - barcode scanner,
  - typed Toast/floating control,
  - shared confirmation dialog,
  - Firestore/storage mappings,
  - legacy document-ID safeguards,
  - canonical sync/no-cache config.

Verification before commit/deploy:
- node --check react-app/src/data/retailProductsData.js PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS, including UI-layer contract.
- npm run build:react PASS.
- Generated React build contract PASS for React 0.4.280 / Build 2026.10.04.381 using /react/assets/index-cKnVsVFm.js.
- git diff --check PASS.
- Canonical public/pos/products/index.html matches public/react/index.html.
- Legacy Products ID inventory: 60/60 present in React.
- Local headless Chrome smoke: /pos/products/ HTTP 200, no pageerror, then expected unauthenticated POS/login routing.
- Existing local system-controls.css 404 remains outside this Products phase.
- Intermediate Build .380 bundle index-DCNt6XXX.js was removed only after confirming no generated entrypoint referenced it; it was never deployed.

Release / deploy / readiness correction:
- Initial Products cutover: React 0.4.280 / Build 2026.10.04.381; Public 0.16.32 / Build 2026.10.04.096.
- Initial implementation commit 005b7d83 (feat: migrate POS products to React) was pushed to origin/feature/react-firebase-port and Firebase Hosting target foodapp deployed successfully.
- Production /pos/products returned HTTP 200 with no-cache/no-store/must-revalidate and /react/assets/index-cKnVsVFm.js.
- During authenticated read-only verification, one live Chrome tab redirected through the central app while a read-only copied Chrome profile with the same valid owner POS session/tenant stayed on /pos/products but exposed an indefinite readiness screen.
- Root cause found in Products-only readiness logic: role settings were a hard gate even for owner/built-in roles, while loadPosRoleSettings() uses a Firestore getDoc without its own timeout. A delayed role-settings read could therefore keep the whole Products screen in loading state.
- Corrective readiness implementation:
  - load cached retail_pos_roles_v1 immediately;
  - owner/admin/manager/cashier/stock/kitchen built-in roles are ready immediately and use existing safe permission fallbacks;
  - custom roles use cached role rows when available and remain permission-gated when no cache exists;
  - role-settings refresh runs in the background with a 6-second timeout;
  - initial Products data load has a 10-second timeout so the full screen cannot remain blocked indefinitely; after that, realtime Firestore watchers continue recovery.
- No permission bypass was added.
- Corrective release candidate: React 0.4.280 / Build 2026.10.04.382; Public 0.16.32 / Build 2026.10.04.097; generated bundle /react/assets/index-BN-Zs4j0.js.
- Full operational/parity/build/generated-contract/git-diff gates PASS for Build .382.
- Pre-deploy authenticated smoke used a read-only copy of the actual Chrome Default profile on the production origin while intercepting only the React bundle with local Build .382:
  - route remained /pos/products,
  - readiness overlay cleared,
  - productTableBody rendered,
  - 20 visible table rows rendered from 1,997 products,
  - categoryManagerRoot, sortManagerRoot, movementList, and Toast all rendered,
  - no HTTP errors and no console errors,
  - PASS.
- Corrective commit 525fcec0 (fix: make POS products readiness resilient) was pushed to origin/feature/react-firebase-port.
- Firebase Hosting target foodapp deployed Build .382 successfully; no Functions, Firestore Rules, or Storage Rules were deployed.
- Production /pos/products returns HTTP 200 with no-cache/no-store/must-revalidate and /react/assets/index-BN-Zs4j0.js.
- Post-deploy authenticated verification used the read-only Chrome-profile copy with the real Production session and no bundle interception:
  - route remained /pos/products,
  - actual deployed bundle index-BN-Zs4j0.js loaded,
  - readiness overlay cleared,
  - productTableBody rendered 20 rows,
  - categoryManagerRoot, sortManagerRoot, movementList, Toast, and floating developer/version control all rendered,
  - no HTTP errors,
  - visual screenshot confirmed the normal Products desktop workspace with 1,997 products and 23,741 aggregate stock in this tenant,
  - PASS.
- The copied-profile console emitted one generic 404 log that was not present in the captured HTTP response list and did not affect Products rendering/actions; no Products HTTP error was observed.
- Canonical Products phase is complete on Production Build .382.
- Next POS migration target in actual menu order: /pos/stock-movements.
- No merge to main.


---

## 2026-10-04 — Retail POS React migration phase 8: canonical Stock Movements /pos/stock-movements

Direction / continuation:
- Continued from the completed canonical Products release. Products is already Production Build 2026.10.04.382; no Products work was reset or recommitted.
- Preserved the uncommitted Stock Movements migration work already present in the working tree.
- Current PENGUIN legacy /pos/stock-movements and task2 /pos/stock-movements were opened read-only and captured before cutover.
- Their visible desktop structure is aligned; row/count differences are environment data differences, not a visual-parity defect.
- Archived pre-cutover public/pos/stock-movements/index.html as tests/fixtures/retail-pos-legacy/pos-stock-movements-index.html.

Legacy surface / behavior parity:
- Legacy fixture contains 17 stable IDs across search/date/type filters, range buttons, four summary values, period text, product filter/datalist, CSV export, table body, and empty state.
- React preserves all 17/17 legacy IDs.
- Retail POS session-first auth, /pos/login next routing, first-allowed full-page redirect, LocaleSwitcher, PosNavigation, PageReadyOverlay, and AppDeveloperPanel are preserved.
- Granular permissions preserved:
  - pos.stock_movements.view_quantity
  - pos.stock_movements.export
- Amount/quantity columns and summary values are hidden without view_quantity.
- CSV action is hidden without export permission.

Data/readiness:
- Stock movement and product data use realtime Firestore watchers.
- Initial movement/product loading is bounded by a 10-second timeout so the page cannot remain indefinitely behind a slow initial read; realtime watchers continue recovery afterward.
- POS role settings use cached/built-in roles immediately and a bounded 6-second remote role-settings wait, matching the Products readiness correction.
- Product filter options merge products from the catalog and product IDs/names/barcodes seen in movement rows.
- Movement search/filtering preserves the current legacy semantics for name/product ID/note, date range, type, and product query.
- Exact movement classification now matches the legacy script:
  - note contains return marker -> return
  - purchase/PO marker -> purchase
  - sale marker -> sale
  - stock-count marker -> count
  - otherwise adjustment
  - explicit item.type is intentionally not used as a fallback because the current legacy MASTER does not use it.
- createdAt is preferred before createdAtServer/updatedAt so displayed/filter dates follow the current legacy page.
- before/after delta remains after - before.
- CSV export retains UTF-8 BOM, legacy column order, period-based filename, and centered app warning dialog when there is no export data.

Visual parity / legacy JS enhancement parity:
- Authored the icons that legacy retail-pos-icons.js injects dynamically:
  - Today / This Month: calendar3 blue
  - All: x-circle rose
  - report heading: bookmark-star green
  - Export CSV: download blue
- Restored the barcode scanner button dynamically added by legacy retail-barcode-scan-tools.js to movementProductFilter.
- Restored the search-clear button beside the scanner.
- React scanner supports BarcodeDetector first and ZXing fallback, camera cleanup, vibrate/beep feedback, and typed global success/error Toasts.
- Scanner UI reuses the five-language pos_products.scanner catalog.
- Added the movement-product-input / movement-filter-clear styling to React-owned retail-barcode-scan-tools.css.
- Removed retail-stock-movements-scroll.css from the page. That stale React-only override forced horizontal table scrolling and is not loaded by the current legacy MASTER; the canonical React page therefore retains the legacy mobile card layout instead.

Canonical cutover:
- tools/sync-react-legacy-entrypoints.py now syncs public/pos/stock-movements/index.html from the React shell.
- firebase.json adds no-cache/no-store/must-revalidate headers for /pos/stock-movements and /pos/stock-movements/**.
- Generated build contract requires canonical /pos/stock-movements to use the current React bundle and contain pos.stock_movements.
- React foundation contract locks:
  - 17-ID fixture inventory,
  - session/page access and granular permissions,
  - bounded role/data readiness,
  - realtime watchers,
  - exact legacy note classification and createdAt precedence,
  - CSV behavior,
  - scanner + typed Toast behavior,
  - semantic icons,
  - legacy mobile card layout / no stale scroll CSS,
  - canonical sync/no-cache configuration.

Verification before commit/deploy:
- PENGUIN legacy and task2 pre-cutover desktop screenshots were captured read-only; both use the same filter/stats/report/scanner layout.
- npm run test:operational PASS.
- npm run test:react-parity PASS, including foundation, migration, parity matrix, P0 actions, callables, tenant access, and UI-layer contracts.
- npm run build:react PASS.
- Generated React build contract PASS for React 0.4.280 / Build 2026.10.04.383 using /react/assets/index-n_l_BCmi.js.
- git diff --check PASS.
- Canonical public/pos/stock-movements/index.html matches public/react/index.html.
- Legacy Stock Movements inventory: 17/17 IDs present in React.
- Scanner DOM/actions present: scanMovementProductBtn, posScanDialog, posScanVideo, posScanStatus.
- Local headless Chrome smoke: /pos/stock-movements/ HTTP 200, no pageerror, then expected unauthenticated POS-login/central-login routing.
- Existing local system-controls.css 404 remains the known local-only issue outside this phase.
- Intermediate unreferenced bundle index-CdyIPQMI.js was removed; it was never deployed.

Release / deploy / visual correction:
- Initial Stock Movements cutover: React 0.4.280 / Build 2026.10.04.383; Public 0.16.32 / Build 2026.10.04.098.
- Implementation commit 0bd89a9a (feat: migrate POS stock movements to React) was pushed to origin/feature/react-firebase-port before deploy.
- Firebase Hosting target foodapp deployed Build .383 successfully; no Functions, Firestore Rules, or Storage Rules were deployed.
- Production /pos/stock-movements returned HTTP 200 with no-cache/no-store/must-revalidate and /react/assets/index-n_l_BCmi.js. Scanner CSS and global Toast CSS returned HTTP 200.
- Authenticated read-only Chrome verification loaded the actual React page, cleared readiness, rendered the current 19 movement rows, four summary cards, filters, product scanner, CSV action, table, and floating developer control.
- Comparing the authenticated .383 screenshot with task2 exposed one remaining visual delta only: the report heading icon was authored as arrow-left-right/sky, while current task2 uses the fallback bookmark-star/green icon for “รายการความเคลื่อนไหว”.
- Corrective implementation changes that heading icon to bi-bookmark-star with green tone and updates the regression contract.
- Corrective release: React 0.4.280 / Build 2026.10.04.384; Public 0.16.32 / Build 2026.10.04.099; generated bundle /react/assets/index-BmPYYVQw.js.
- Full operational/parity/build/generated-contract/git-diff gates PASS for Build .384.
- Corrective commit d958d964 (fix: finalize POS stock movements visual parity) was pushed to origin/feature/react-firebase-port before deploy.
- Firebase Hosting target foodapp deployed Build .384 successfully; no Functions, Firestore Rules, or Storage Rules were deployed.
- Production /pos/stock-movements returned HTTP 200 with no-cache/no-store/must-revalidate and /react/assets/index-BmPYYVQw.js; deployed bundle contains pos.stock_movements and bookmark-star.
- Final authenticated read-only Chrome verification confirmed the task2 bookmark-star/green report heading, Today/Month/All icons, CSV icon, barcode scanner, current movement rows, summary cards, and floating developer/version control.
- No Production stock movement or catalog data was modified during verification.
- Chrome PENGUIN tab was returned to canonical /pos/stock-movements without a verification query.
- Stock Movements phase is complete. Next actual POS menu route: /pos/stock-counts.
- No merge to main.


---

## 2026-10-04 — Retail POS React migration phase 9: canonical Stock Counts /pos/stock-counts

Direction / legacy reference:
- Continued from completed Stock Movements Production Build 2026.10.04.384.
- Preserved the existing uncommitted Stock Counts migration work; no reset/clean/discard was used.
- Current PENGUIN legacy /pos/stock-counts and task2 /pos/stock-counts were inspected read-only at both the top/counting area and lower summary/history area before cutover.
- PENGUIN/task2 visual structure matches; visible quantity differences are environment data, not layout defects.
- Archived pre-cutover public/pos/stock-counts/index.html as tests/fixtures/retail-pos-legacy/pos-stock-counts-index.html.
- Legacy fixture exposes 21 stable IDs across count metadata, search/filter, table, summary, actions, history, and Toast; React preserves 21/21.

Access / readiness / realtime:
- Preserved Retail POS session-first auth, /pos/login next routing, first-allowed full-page permission redirect, LocaleSwitcher, PosNavigation, PageReadyOverlay, and AppDeveloperPanel.
- Page permission: pos.stock_counts.
- Granular permissions preserved:
  - pos.stock_counts.perform
  - pos.stock_counts.view_value
  - pos.stock_counts.view_history
- Legacy built-in stock/admin/manager behavior is preserved when no explicit granular permissions are stored.
- Cached role settings are usable immediately; remote role settings are bounded by a 6-second timeout.
- Initial Products + Stock Counts loading is bounded by 10 seconds so readiness cannot hang indefinitely.
- Realtime Firestore watchers are used for products and stockCounts.

Count behavior / visual parity:
- Preserved count name/date/staff/note fields, product search/filter, fill-system, clear-actual, actual quantity input, Enter-to-next-row behavior, variance calculations, summary, reset/confirm, and history search.
- Barcode search preserves native BarcodeDetector first with ZXing fallback and focuses the matched product actual-count field.
- Scanner not-found/success/camera failures use typed global Toast feedback.
- Destructive stock adjustment confirmation uses shared sweetConfirm; no browser-native confirm remains.
- Authored the legacy semantic icons directly in React:
  - new-count/history heading and fill-system: clipboard-check
  - clear actual: x
  - reset/new: plus
  - confirm/apply stock: check
- Existing retail-stock-counts.css retains the legacy mobile card layout.
- Five-language pos_stock.counts translations are used throughout.
- Removed hard-coded Thai-only “ทุน” and “บาท” from JSX; cost/currency/date display now uses existing translation keys and locale-aware formatting.

Firestore / compatibility safeguards:
- commitRetailStockCount reads all selected product documents before transaction writes and writes stock to the normalized product _documentId when legacy document IDs differ from logical product IDs.
- Count IDs retain the legacy COUNT-<timestamp> shape.
- Stock-count history writes both legacy and React-compatible item fields:
  - legacy: systemQty, actualQty, variance
  - React: system, actual, difference
  - shared: varianceValue, cost
- Summary writes both itemCount and countedItems plus differenceCount/shortQty/overQty/varianceValue.
- Important Rules compatibility: current Firestore Rules allow the built-in stock role to create stockCounts and update product stock, but its stockMovements branch only allows adjustment/purchase types.
- No other app path depends on stockMovements.type === count, while the Stock Movements page classifies stock-count activity from its translated note/reference.
- Therefore stock-count movement records use type=adjustment plus referenceType=stock_count/referenceId and translated movementNote. This preserves the legacy “ตรวจนับสต็อก” UI and lets the stock role complete the transaction without any Firestore Rules deployment.
- No Firestore Rules, Storage Rules, or Functions changes are required for this cutover.

Canonical cutover / contracts:
- tools/sync-react-legacy-entrypoints.py now syncs public/pos/stock-counts/index.html from the React shell.
- firebase.json adds no-cache/no-store/must-revalidate headers for /pos/stock-counts and /pos/stock-counts/**.
- Generated build contract requires canonical /pos/stock-counts to use the current React bundle and contain pos.stock_counts.
- React foundation regression coverage locks the 21-ID inventory, session/access behavior, three granular permissions, bounded readiness, realtime watchers, scanner/Toast/dialog behavior, semantic icons, five-language/no-hardcoded-Thai display, legacy/React schema compatibility, stock-role Rules compatibility, CSS parity, canonical sync, and Hosting cache-bust.

Verification before commit/deploy:
- node --check react-app/src/data/retailProductsData.js PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS, including foundation, migration, parity matrix, P0 actions, callables, tenant access, and UI-layer contracts.
- npm run build:react PASS.
- Generated React build contract PASS for React 0.4.280 / Build 2026.10.04.385 using /react/assets/index-CSEK50NQ.js.
- git diff --check PASS.
- Canonical public/pos/stock-counts/index.html matches public/react/index.html.
- Legacy Stock Counts inventory: 21/21 IDs present in React.
- No native confirm remains.
- Local headless Chrome smoke: /pos/stock-counts/ HTTP 200, no pageerror, then expected unauthenticated POS-login/central-login routing.
- Existing local system-controls.css 404 remains the known local-only issue outside this phase.
- Intermediate unreferenced bundle index-aH_Z77cA.js was removed; it was never deployed.

Release / deploy:
- React 0.4.280 / Build 2026.10.04.385.
- Public 0.16.32 / Build 2026.10.04.100.
- Implementation commit 4aa5227a (feat: migrate POS stock counts to React) was pushed to origin/feature/react-firebase-port.
- Firebase Hosting target foodapp deployed successfully; no Functions, Firestore Rules, or Storage Rules were deployed.
- Production /pos/stock-counts returns HTTP 200 with Cache-Control: no-cache, no-store, must-revalidate and /react/assets/index-CSEK50NQ.js.
- Authenticated read-only verification used the existing copied Chrome Default profile with the real Production owner POS session:
  - stayed on /pos/stock-counts and loaded the deployed index-CSEK50NQ.js bundle,
  - readiness overlay cleared,
  - all 21/21 legacy IDs rendered,
  - countTableBody rendered 1,997 product rows,
  - heading/fill/clear/reset/confirm icons, barcode scanner, history panel, Toast target, and floating developer/version control rendered,
  - no HTTP errors and no page errors,
  - no count action was clicked and no Production stock/count data was modified.
- Production mobile smoke at 390px: document/body scrollWidth exactly 390px, no horizontal overflow, count table switched to block/card mode, thead was hidden, rows/actions used grid layout, readiness cleared, and no HTTP/page errors occurred.
- Canonical Stock Counts phase is complete on Production Build 2026.10.04.385.
- Next POS migration target in actual menu order: /pos/purchases.
- No merge to main.


---

## 2026-10-04 — Shared Retail POS navigation redesign: Modern Card v2

User direction / exception:
- User explicitly requested a new POS menu design because the existing drawer looked visually scattered.
- After reviewing design options, user selected “แบบที่ 2 / Modern Card” and approved the expanded-submenu mockup for implementation.
- This is an intentional user-approved exception to the earlier POS 1:1 visual-parity rule, but only for the shared POS navigation drawer. Route-specific POS screens and behavior remain governed by their existing migration/parity rules.
- Do not revert the shared POS menu back to the old drawer merely to match the old task2/legacy visual.

Scope:
- Apply the same Modern Card v2 menu to:
  - React POS routes through react-app/src/components/PosNavigation.jsx and React parity CSS.
  - Remaining legacy POS routes through public/assets/js/retail-pos-navigation.js and public/assets/css/retail-pos-navigation.css.
- POS permissions, route hrefs, role resolution, logout behavior, central-home behavior, and multi-group accordion behavior are unchanged.

Modern Card v2 design:
- Drawer width reduced to a compact 372px maximum on desktop; 360px maximum on small mobile.
- Header is compact with a simple close action.
- User Profile is a dedicated pale-green card with circular user icon, name, and role/email hierarchy.
- “กลับหน้าระบบกลาง” is a separate muted action row beneath the profile card.
- Menu groups are independent rounded cards with semantic group tones:
  - sales emerald
  - stock teal
  - purchasing orange
  - customer pink
  - system slate
- Multiple groups can remain expanded at the same time.
- Open groups receive a subtle tone-specific pastel header treatment.
- Submenus are compact list rows rather than widely separated cards.
- Every submenu row has a right-chevron affordance.
- Current route uses aria-current=page and a stronger pale-green active row.
- Menu item icon tones remain the established POS semantic tones.
- Navigation content scrolls independently while the profile/home area stays above it and Logout remains in a dedicated bottom footer region.
- Logout remains a full-width red action.
- Backdrop and panel shadow were softened for a cleaner contemporary sheet/card feel.
- Desktop and mobile spacing were deliberately compacted to show more actions without the old scattered appearance.

Shared implementation:
- React PosNavigation now authors data-menu-tone per group, aria-current on the current link, and submenu right chevrons.
- Legacy retail-pos-navigation.js authors the same data-menu-tone/current/chevron markup so still-static POS routes use the same design.
- Legacy central-home and logout actions now author their icons directly; the existing retail-pos-icons enhancer detects authored icons and does not duplicate them.
- Modern Card v2 CSS is appended to both:
  - public/assets/css/retail-pos-navigation.css
  - react-app/public/parity/css/retail-pos-navigation.css
- Generated React parity copy public/react/parity/css/retail-pos-navigation.css is updated by the React build.

Cache safety:
- React parity styles already use REACT_RELEASE.build in useParityPage, so Build 2026.10.04.386 cache-busts the new navigation CSS automatically.
- The eight remaining legacy POS HTML routes had old fixed navigation asset query keys. Both retail-pos-navigation.css and retail-pos-navigation.js were bumped to v=20261004-101 on:
  - /pos/purchases
  - /pos/payables
  - /pos/suppliers
  - /pos/customers
  - /pos/settings
  - /pos/backup
  - /pos/users
  - /pos/forbidden
- This prevents browsers from showing the old drawer after Hosting deploy without requiring a hard refresh.

Regression / visual verification before deploy:
- public/assets/js/retail-pos-navigation.js node syntax check PASS.
- React foundation contract now locks group tone, active-page semantics, submenu chevrons, compact Modern Card CSS markers, independent nav scrolling, and footer layout.
- npm run test:operational PASS.
- npm run test:react-parity PASS, including UI-layer contract.
- npm run build:react PASS.
- Generated React build contract PASS for React 0.4.280 / Build 2026.10.04.386 using /react/assets/index-BETob66p.js.
- git diff --check PASS.
- Desktop visual preview at 1600x900:
  - drawer width = 372px,
  - two expanded groups fit cleanly,
  - navigation/client area and bottom footer remain separated,
  - active submenu treatment and semantic group cards match the approved Modern Card direction.
- Mobile geometry preview at 390x844:
  - document scroll width = 390px,
  - drawer width = 360px,
  - no horizontal overflow,
  - nav area = 569px,
  - logout footer bottom = 834px (10px bottom panel padding),
  - PASS.

Release / deploy:
- React 0.4.280 / Build 2026.10.04.386.
- Public 0.16.32 / Build 2026.10.04.101.
- Implementation commit 9fde6f47 (feat: redesign POS menu with modern card layout) was pushed to origin/feature/react-firebase-port.
- Firebase Hosting target foodapp deployed successfully; no Functions, Firestore Rules, or Storage Rules were deployed.
- Production HTTP checks:
  - /pos/stock-counts returns HTTP 200 with no-cache/no-store/must-revalidate and /react/assets/index-BETob66p.js.
  - /pos/purchases returns HTTP 200 and references retail-pos-navigation.css/js with v=20261004-101.
  - deployed React and legacy navigation CSS/JS contain the Modern Card v2 markers/tone/chevron rules.
- Authenticated read-only Production verification used the copied owner Chrome profile so the user's active Chrome tabs were not disturbed.
- React route verification on /pos/stock-counts:
  - drawer width 372px; panel height 900px; nav overflow-y auto; footer bottom 886px,
  - profile uses the approved pale-green gradient card,
  - 5 menu groups render, current “ตรวจนับสต็อก” has aria-current=page and the active green gradient,
  - all 15 permitted submenu links render right chevrons,
  - opening Sales while Stock is already open results in two simultaneous open groups,
  - no HTTP or page errors.
- Legacy route verification on /pos/purchases:
  - same 372px Modern Card drawer and profile/home/footer structure,
  - current “รับสินค้าเข้า” has the same active treatment,
  - all 15 permitted submenu links render right chevrons,
  - opening Stock while Purchasing is already open results in two simultaneous open groups,
  - no HTTP or page errors.
- Only drawer expansion interactions were used; no Production data-changing POS action was executed.
- Modern Card v2 shared POS menu redesign is complete on Production Build 2026.10.04.386.
- No merge to main.


---

## 2026-10-04 — POS Modern Card v2.1: larger spacing, wider drawer, stronger color

User feedback:
- Modern Card v2 structure was accepted, but the drawer felt too small/narrow, vertical spacing was too tight, and colors were too pale.
- Keep the approved Modern Card structure and multi-open behavior; increase scale, breathing room, and visual contrast instead of redesigning again.

v2.1 visual changes:
- Desktop drawer max width: 372px -> 420px.
- Tablet drawer max width: 410px / 97vw.
- Small mobile drawer: up to the full 390px viewport with no horizontal overflow.
- Panel padding increased to 20px 18px 16px on desktop.
- Header height/font increased.
- Profile card:
  - larger 44px avatar,
  - larger name/subtitle text,
  - 14px/15px padding,
  - stronger green gradient and border/shadow.
- Central-home action:
  - 46px min height,
  - larger icon and text,
  - stronger neutral-green background/border.
- Category cards:
  - 54px desktop header height,
  - 35px icons,
  - 15px card radius,
  - more vertical gap between groups,
  - stronger emerald/teal/orange/pink/slate borders and pastel fills.
- Submenu rows:
  - 45px desktop height,
  - larger 30px icons,
  - larger font and 10px icon/text gap,
  - stronger hover treatment.
- Active submenu:
  - stronger green gradient (#bfeccc -> #d9f5e2),
  - 3px green inset indicator,
  - heavier text and stronger chevron.
- Logout:
  - 48px desktop height,
  - stronger red surface and shadow.
- Mobile keeps the same hierarchy but uses slightly smaller 50px category / 42px submenu rows to preserve usability without crowding.
- Independent nav scrolling and bottom logout remain unchanged.

Cache / regression:
- React uses Build 2026.10.04.387 as its parity-asset cache key.
- Remaining legacy POS routes bumped navigation CSS only from v=20261004-101 to v=20261004-102; navigation JS remains v=20261004-101 because markup/behavior did not change in v2.1.
- React foundation contract now locks the v2.1 420px width, 54px/45px row sizing, stronger active gradient, independent nav scrolling, and active/current treatment.

Verification:
- Desktop geometry preview 1600x900:
  - drawer width 420px,
  - panel padding 20/18/16,
  - profile height 74px,
  - category header 55px,
  - submenu row 45px,
  - footer height 62px,
  - no horizontal overflow.
- Mobile geometry preview 390x844:
  - drawer width 390px,
  - document width 390px,
  - profile height 67px,
  - category header 50px,
  - submenu row 42px,
  - footer bottom 832px,
  - no horizontal overflow.
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- npm run build:react PASS.
- Generated React build contract PASS for React 0.4.280 / Build 2026.10.04.387 using /react/assets/index-DwT01RT7.js.
- git diff --check PASS.

Release / deploy:
- React 0.4.280 / Build 2026.10.04.387.
- Public 0.16.32 / Build 2026.10.04.102.
- Implementation commit 462d8a48 (fix: enlarge and strengthen POS modern card menu) was pushed to origin/feature/react-firebase-port.
- Firebase Hosting target foodapp deployed successfully; no Functions, Firestore Rules, or Storage Rules were deployed.
- Production HTTP checks:
  - /pos/stock-counts returns HTTP 200 with no-cache/no-store/must-revalidate and /react/assets/index-DwT01RT7.js.
  - /pos/purchases returns HTTP 200 and references retail-pos-navigation.css?v=20261004-102.
  - deployed React and legacy navigation CSS both contain the Modern Card v2.1 420px/45px rules.
- Authenticated read-only Production verification with the copied owner profile:
  - React /pos/stock-counts: drawer 420px, profile 74px, group 55px, active submenu 45px, two simultaneous open groups, 15 chevrons, nav overflow auto, footer bottom 884px, no HTTP/page errors.
  - Legacy /pos/purchases: same 420/74/55/45 geometry, same stronger active green treatment, two simultaneous open groups, 15 chevrons, no HTTP/page errors.
  - Mobile 390x844 on React /pos/stock-counts: drawer 390px, group 50px, submenu 42px, document width 390px, no horizontal overflow, no HTTP/page errors.
- No Production data-changing POS action was executed.
- Modern Card v2.1 is complete on Production Build 2026.10.04.387.
- No merge to main.


---

## 2026-10-04 — POS Modern Card v2.2: multi-open scroll resilience

User issue:
- When several POS menu cards were expanded together, lower menu content could extend below the visible drawer area and appear inaccessible.
- User chose to keep multi-open accordion behavior rather than collapse to one group at a time.

Root cause / fix direction:
- The drawer already had a scrollable nav, but the center section still relied on flex auto sizing and opened groups were not forced to remain non-shrinking.
- Newly expanded lower groups also did not move into the visible nav viewport automatically.
- The fix keeps top/header/profile/central-home and bottom/logout fixed while only the center menu list scrolls.

Implementation:
- Shared Modern Card v2.1 visual sizing/color remains unchanged.
- Drawer now explicitly uses:
  - height/max-height 100dvh,
  - flex column,
  - min-height 0,
  - overflow hidden.
- Header, profile, central-home, and footer are flex:0 0 auto.
- Center nav now uses flex:1 1 0%, min-height:0, height:0, overflow-y:auto, overflow-x:hidden, stable scrollbar gutter, touch momentum scrolling, and extra bottom padding.
- Menu cards and open submenu lists are non-shrinking.
- Safe-area bottom padding is preserved for the footer.
- Every group has a data-menu-group-card identifier.
- React PosNavigation auto-scrolls a newly opened group into the nearest visible nav area with double requestAnimationFrame after render.
- Legacy retail-pos-navigation.js applies the same data attribute and scrollIntoView behavior after group expansion.
- Multiple groups can still remain open simultaneously.

Legacy cache safety:
- Remaining legacy POS routes bump both shared navigation CSS and JS to v=20261004-103 because both layout and expansion behavior changed.
- React routes use Build 2026.10.04.388 as the parity asset cache key.

Regression / direct all-open test:
- React foundation contract now locks:
  - v2.2 flex/scroll/safe-area rules,
  - React data-menu-group-card + auto-scroll behavior,
  - legacy data-menu-group-card + auto-scroll behavior.
- Synthetic browser test opened all 5 groups with 18 submenu items:
  - Desktop 1600x900: nav client 590px, scroll height 680px, max internal scroll 90px; footer stayed fixed at 822–884px; after scroll, last group fit entirely inside nav viewport.
  - Mobile 390x844: nav client 567px, scroll height 646px, max internal scroll 79px; footer stayed fixed at 774–832px; after scroll, last group fit entirely inside nav viewport.
  - document width matched viewport on both sizes; no horizontal overflow.
  - ALL_OPEN_SCROLL=PASS.

Full verification:
- public/assets/js/retail-pos-navigation.js node syntax check PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- npm run build:react PASS.
- Generated React build contract PASS for React 0.4.280 / Build 2026.10.04.388 using /react/assets/index-C9WRcpgj.js.
- git diff --check PASS.

Release / deploy:
- React 0.4.280 / Build 2026.10.04.388.
- Public 0.16.32 / Build 2026.10.04.103.
- Implementation commit 2fac007c (fix: make multi-open POS menu fully scrollable) was pushed to origin/feature/react-firebase-port.
- Firebase Hosting target foodapp deployed successfully; no Functions, Firestore Rules, or Storage Rules were deployed.
- Production HTTP checks:
  - React /pos/sales returns HTTP 200 with no-cache/no-store/must-revalidate and /react/assets/index-C9WRcpgj.js.
  - Legacy /pos/purchases returns HTTP 200 and references retail-pos-navigation.css/js?v=20261004-103.
  - deployed React/legacy CSS contains Modern Card v2.2 flex-scroll rules; deployed legacy JS contains auto-scroll logic.
- Authenticated read-only Production all-open verification with copied owner profile:
  - React desktop /pos/sales: before 1/5 group open; after 5/5 groups open with 15 submenu links, nav client 590px / scroll 680px / max scroll 90px / scrollTop 90px, last group fully visible, footer stayed at 822–884px, no HTTP/page errors.
  - Legacy desktop /pos/purchases: same 5/5, 15 links, 590/680/90/90 scroll metrics, last group fully visible, footer stayed at 822–884px, no HTTP/page errors.
  - React mobile 390x844 /pos/sales: after 5/5 groups open with 15 links, nav client 567px / scroll 646px / max scroll 79px / scrollTop 79px, last group fully visible, footer stayed at 774–832px, document width exactly 390px, no horizontal overflow and no HTTP/page errors.
- Production browser contract result: PRODUCTION_ALL_OPEN_SCROLL=PASS.
- Only drawer expansion/scroll interactions were used; no Production data-changing POS action was executed.
- Modern Card v2.2 multi-open scroll fix is complete on Production Build 2026.10.04.388.
- No merge to main.


---

## 2026-10-04 — POS Modern Card v2.3: expanded-card overlap root-cause fix

User issue:
- Even after v2.2 made the center menu scrollable, screenshots showed expanded menu cards visually colliding/overlapping the next category.
- The issue was most obvious when Sales, Stock, and Purchasing were opened together.

Production root-cause diagnosis:
- Actual Production DOM inspection on /pos with all permitted groups open showed the nav remained CSS Grid.
- Grid template rows were fixed at approximately 103px each:
  - gridTemplateRows = 103px 103px 103px 103px 103px.
- Actual expanded card heights were much larger:
  - Sales 315px,
  - Stock 217px,
  - Purchasing 217px,
  - Customer 119px,
  - System 217px.
- Because a grid item can visually overflow its assigned row track, the next grid row began before the previous expanded card ended:
  - Sales overlapped the next row by 200px,
  - Stock by 102px,
  - Purchasing by 102px,
  - Customer by 4px.
- This exactly matched the user's screenshots.
- v2.2 scrolling was functioning correctly; the remaining problem was grid track sizing, not scrollability.

v2.3 fix:
- Keep all v2.1 visual sizing/colors and all v2.2 scroll/auto-scroll behavior.
- Change only the center nav layout model from CSS Grid to a natural-height flex column:
  - display:flex,
  - flex-direction:column,
  - align-items:stretch,
  - justify-content:flex-start.
- Expanded menu groups remain flex:0 0 auto and use height:auto/min-height:0.
- Group button/submenu remain static normal-flow content at width:100%.
- Open submenu height remains auto.
- This makes every following category start only after the previous category's actual rendered content height plus the configured 12px gap.

Real Production DOM pre-deploy injection test:
- Injected only the local v2.3 override into the current Production /pos DOM before deploy.
- nav changed to flex / column.
- All 5 groups remained open.
- Actual group heights remained 315 / 217 / 217 / 119 / 217px.
- Total nav scroll height became 1160px with max scroll 570px, reflecting the real expanded content instead of compressed grid tracks.
- Every adjacent group pair had overlapNext = -12px, meaning a true 12px gap and zero overlap.
- V23_INJECTED_REAL_DOM=PASS.

Cache safety:
- React uses Build 2026.10.04.389 as the parity CSS cache key.
- Remaining legacy POS routes bump retail-pos-navigation.css from v=20261004-103 to v=20261004-104.
- Legacy navigation JS stays v=20261004-103 because v2.3 changes layout CSS only.

Regression / verification:
- React foundation contract now locks v2.3 flex-column/natural-height rules in addition to existing v2.2 scrolling and auto-scroll rules.
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- npm run build:react PASS.
- Generated React build contract PASS for React 0.4.280 / Build 2026.10.04.389 using /react/assets/index-D2SmItWg.js.
- git diff --check PASS.

Release / deploy:
- React 0.4.280 / Build 2026.10.04.389.
- Public 0.16.32 / Build 2026.10.04.104.
- Implementation commit 5bae6a5b (fix: prevent expanded POS menu card overlap) was pushed to origin/feature/react-firebase-port.
- Firebase Hosting target foodapp deployed successfully; no Functions, Firestore Rules, or Storage Rules were deployed.
- Production HTTP checks:
  - React /pos returns HTTP 200 with no-cache/no-store/must-revalidate and /react/assets/index-D2SmItWg.js.
  - Legacy /pos/purchases returns HTTP 200 and references retail-pos-navigation.css?v=20261004-104.
  - deployed navigation CSS contains Modern Card v2.3 flex-column natural-height rules.
- Authenticated read-only Production verification with all 5 permitted groups open:
  - React desktop /pos: nav flex-column, client 590px / scroll 1160px / scrollTop 568px; card heights 315/217/217/119/217px; every adjacent pair overlapNext=-12px (true 12px gap); last group fully visible; footer fixed at 822–884px; no HTTP/page errors.
  - Legacy desktop /pos/purchases: same 590/1160/568 metrics, same card heights, same -12px gaps, last group fully visible, footer fixed, no HTTP/page errors.
  - React mobile 390x844 /pos: nav client 567px / scroll 1064px / scrollTop 495px; card heights 293/201/201/109/201px; every adjacent pair overlapNext=-9px; last group fully visible; footer fixed at 774–832px; document width exactly 390px; no horizontal overflow or HTTP/page errors.
- Production browser contract result: PRODUCTION_V23_NO_OVERLAP=PASS.
- No Production data-changing POS action was executed.
- Modern Card v2.3 expanded-card overlap fix is complete on Production Build 2026.10.04.389.
- No merge to main.

---

## 2026-10-04 — Retail POS tenant-selectable menu themes (5 choices)

User direction:
- Keep the current approved Modern Card menu, but make POS menu appearance selectable per store/tenant.
- Support five choices: Minimal Clean, Modern Card, Sidebar divided into sections, Summary Dashboard, and Dark Mode Hi-Tech.
- Theme choice must work across already-migrated React POS routes and remaining legacy POS routes without changing permissions, routing, or operational data logic.

Implementation:
- Added tenant-scoped theme preference document at `tenants/{tenantId}/settings/pos-theme` with field `theme`.
- Default/fallback remains `modern-card`, so tenants with no setting keep the current Production appearance.
- Added React theme runtime/config in `react-app/src/config/posThemes.js`, `react-app/src/hooks/usePosTheme.js`, and `react-app/src/data/posThemeData.js`.
- Added legacy theme runtime in `public/assets/js/retail-pos-theme.js`.
- Added matching `retail-pos-themes.css` to React parity assets and legacy public assets.
- Modern Card intentionally inherits the approved v2.1/v2.2/v2.3 drawer implementation rather than duplicating or replacing it.
- Theme 1 Minimal Clean reduces visual decoration while retaining the same menu structure and permissions.
- Theme 3 Section Sidebar keeps every permitted category expanded and presents category headings as fixed section labels.
- Theme 4 Summary Dashboard adds a read-only summary inside the drawer: today's sales, bill count, and products with stock.
- Theme 4 preserves permission boundaries: sales/bill metrics are queried only with `pos.sales`; stock is queried only with `pos.products`; unauthorized metrics render `—` and their collection is not queried.
- Theme 5 Dark Mode Hi-Tech uses a dark teal/green PENGUIN visual treatment while preserving all existing navigation semantics.
- Theme changes affect presentation only. Menu permissions, first-allowed-route behavior, POS session handling, Firestore collection/schema names, sale/stock writes, and other operational logic are unchanged.

POS Settings:
- Added a responsive five-card theme picker to current legacy `/pos/settings`.
- Added the same picker to React `PosSettingsPage` for its later canonical cutover.
- Existing legacy local-first settings sync now includes `pos-theme`.
- React store settings load/save now includes `pos-theme`.
- Selecting a theme previews it immediately, but an unsaved preview is not persisted to the theme cache. The persistent cache is updated only after the saved Firestore setting is loaded/saved.
- Existing Firestore tenant settings rule already permits tenant admins to write `pos-theme`; no Firestore Rules change is required.

Localization:
- Added Theme Settings, all five option names/descriptions, and Theme 4 summary labels for Thai, English, Myanmar, Lao, and Khmer.
- Bumped legacy POS translation/bootstrap cache identity to `20261004-105`.

Regression contracts:
- React foundation contract now locks the five theme IDs, Modern Card fallback, tenant settings persistence, legacy + React runtime coverage, Theme 3 behavior, Theme 4 lazy/permission-aware reads, theme CSS coverage, all five-language translation sets, and read-only summary behavior.

Verification:
- `node --check` PASS for `retail-pos-theme.js`, `retail-pos-navigation.js`, `retail-pos-settings.js`, and `retail-pos-i18n-bootstrap.js`.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for React Build `2026.10.04.390` using `/react/assets/index-Bx4RMv0N.js`.
- `git diff --check` PASS.
- Synthetic real-Chrome geometry test PASS for all five themes at desktop 1440x900 and mobile 390x844.
- All five themes had zero adjacent-card overlap and no horizontal overflow; Theme 4 summary was visible only for Summary theme.
- Actual local legacy `/pos/settings` was then exercised through the existing Google Chrome executable at 1440x900 and 390x844 with a non-writing owner preview session: all five radios rendered, each theme applied to the shared drawer, Theme 3 opened all 5 groups, Theme 4 alone displayed the summary block, no menu-card overlap/horizontal overflow occurred, and there were zero HTTP/page errors.
- Unsaved theme previews on actual `/pos/settings` were verified not to alter the persisted theme cache after the saved `modern-card` value had stabilized.
- Playwright's bundled browser was not installed on the Mac; browser checks used the existing local Google Chrome executable and completed successfully.
- After Hosting deploy, authenticated read-only Production verification passed on React `/pos/sales` and legacy `/pos/purchases` at 1440x900 and 390x844 for all five themes. Every theme had zero menu-card overlap and no horizontal overflow; Theme 3 kept all 5 permitted groups open; Theme 4 alone displayed the summary block; HTTP and page error counts were zero.
- Production `/pos/settings` was also verified at 1440x900 and 390x844. All five theme previews applied immediately and the persisted theme-cache entries stayed unchanged until Save; no Production data-changing action was executed.
- The earlier isolated local static-server 404 was rechecked on the final bundle and did not reproduce: HTTP 4xx/5xx, failed requests, and page errors were all empty, so no asset or logic change was required.

Release / deploy state:
- React Version `0.4.280` / Build `2026.10.04.390`.
- Public Version `0.16.32` / Build `2026.10.04.105`.
- Implementation commit `3204418f` (`feat: add tenant-selectable POS menu themes`) was pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Deployment scope was Hosting only. No Functions, Firestore Rules, or Storage Rules were deployed for this phase.
- No merge to `main`.
- Next POS route migration remains `/pos/purchases`.

---

## 2026-10-04 — POS drawer logout icon spacing

Symptom / request:
- In the shared POS navigation drawer, the logout icon sat too close to the `ออกจากระบบ` label, clearly visible on legacy `/pos/customers`.

Root cause:
- The logout rule declared `gap`, but the button itself was not explicitly forced to a flex layout in the shared navigation CSS. Depending on the page-level button styles, the gap therefore did not reliably create space between the Bootstrap icon and label.

Change:
- Made `#posLogoutBtn` an explicit centered flex row in the shared POS navigation CSS.
- Increased the icon/label spacing to a consistent 12px.
- Applied the same source change to legacy and React parity CSS so migrated and not-yet-migrated POS routes remain visually aligned.
- Bumped the legacy navigation stylesheet cache key on all remaining legacy POS routes so the fix is not hidden behind the previous cached CSS.
- Added a React foundation regression assertion for the logout icon/label spacing.
- Prepared release identity React `0.4.280 / 2026.10.04.391` and Public `0.16.32 / 2026.10.04.106`.

Important files:
- `public/assets/css/retail-pos-navigation.css`
- `react-app/public/parity/css/retail-pos-navigation.css`
- `tools/react-foundation-contract.mjs`
- remaining legacy `public/pos/*/index.html` navigation cache references
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for `2026.10.04.391` using `/react/assets/index-Cu6KBM8B.js`.
- `git diff --check` PASS.

Deploy state:
- Implementation commit `1dd39dab` — `fix: space POS logout icon` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production asset verification PASS: `/pos/customers` references `retail-pos-navigation.css?v=20261004-106`; both legacy and React parity navigation CSS expose `column-gap:12px!important`; `/pos` serves the `index-Cu6KBM8B.js` React bundle.
- Deployment scope was Hosting only; no Functions, Firestore Rules, or Storage Rules changes.
- No merge to `main`.

---

## 2026-10-04 — Canonical React migration for POS Purchases

Scope / request:
- Continue the Retail POS React migration with `/pos/purchases` as the next canonical route.
- Preserve the current Production legacy Purchases UI/behavior 1:1 while keeping the approved shared POS theme/navigation drawer.

Legacy MASTER inventory:
- Captured the pre-cutover `public/pos/purchases/index.html` as `tests/fixtures/retail-pos-legacy/pos-purchases-index.html` before the React shell replaces the route.
- Preserved the 16 static legacy IDs plus the report/scanner runtime controls added by `retail-purchases-report.js` and `retail-barcode-scan-tools.js`.
- Preserved supplier hints, multi-line receiving, stock-before display, weighted-average cost, duplicate-product validation, purchase history/search, date report filters, summary stats, supplier/product rankings, CSV export, and barcode selection behavior.

React implementation:
- Rebuilt `PosPurchasesPage` around the existing five-language `pos_purchasing.purchases` catalog and the current legacy Purchases CSS.
- Added the canonical POS session/access flow (`getRetailPosSession`, `canUseRetailPos`, first-allowed-route redirect), bounded role-settings readiness, PageReadyOverlay, and realtime product/supplier/purchase watchers.
- Enforced granular `pos.purchases.create` and `pos.purchases.view_cost` behavior in React without changing the page-level `pos.purchases` permission.
- Added the legacy report/filter/ranking/CSV experience and shared SweetAlert warning for empty CSV exports.
- Added the legacy barcode scanner behavior with BarcodeDetector and ZXing fallback plus typed Toast feedback.
- Kept the shared tenant-selectable POS navigation/theme layer and `currentKey="pos.purchases"`.

Data integrity:
- Extended `retailPurchasingData` with realtime supplier/purchase watchers and legacy Firestore document-ID preservation.
- Purchase receiving now uses `PO-{timestamp}` IDs, validates duplicate products, reads all product documents before transaction writes, updates stock and weighted-average cost atomically, writes purchase stock movements, and preserves credit-days/due-date/payable fields.
- No Firestore Rules, Storage Rules, or Cloud Functions change is required; existing purchase/product/stock-movement role rules cover this flow.

Cutover / cache:
- Added `/pos/purchases` to `sync-react-legacy-entrypoints.py` so postbuild replaces the canonical legacy entry with the React shell.
- Added no-cache Hosting headers for `/pos/purchases` and `/pos/purchases/**`.
- Scanner runtime CSS is now extracted by the parity sync and loaded by the React route.
- Prepared React `0.4.280 / 2026.10.04.392` and Public `0.16.32 / 2026.10.04.107`; generated bundle is `/react/assets/index-C4OBjI8J.js`.

Verification:
- `node --check react-app/src/data/retailPurchasingData.js` PASS.
- React Purchases JSX syntax check through esbuild PASS.
- React foundation contract PASS with new Purchases legacy-ID/report/scanner/permission/data-safety assertions.
- Purchase translation-key coverage PASS for TH / EN / MY / LO / KM.
- Laravel MASTER Purchases/report CSS parity check PASS (only trailing-newline difference on the main stylesheet).
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS: migration coverage 53 routes / 21 POS, parity matrix PASS, P0 contract PASS, callable contract 54 refs / 0 missing, tenant-access PASS, UI-layer PASS.
- `npm run build:react` PASS; generated React build contract PASS for `2026.10.04.392` / `/react/assets/index-C4OBjI8J.js`.
- `git diff --check` PASS.
- Authenticated read-only browser test used the existing Production origin/session while intercepting the new local React shell/assets before deployment: Desktop 1440x900 and Mobile 390x844 both PASS, all 28 expected static/runtime IDs present, no raw translation keys, no document-level horizontal overflow, mobile purchase table scrolls internally, Modern Card theme/menu present, and zero page/request/HTTP errors.
- No purchase submit, stock write, supplier write, or other Production data-changing action was executed during browser verification.

Deploy state:
- Implementation commit `9314bc29` — `feat: migrate POS purchases to React` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.04.392` and Public `0.16.32 / 2026.10.04.107`.
- Production `/pos/purchases` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-C4OBjI8J.js`.
- Authenticated Production browser contract PASS at 1440x900 and 390x844: 28/28 expected IDs present, no raw translation keys, no document overflow, mobile table scroll contained internally, add/remove-row and this-month/all/search interactions pass, current POS menu is `/pos/purchases`, and zero page/request/HTTP errors remain after excluding expected aborted Firestore Listen long-polls.
- No purchase submit, stock write, supplier write, or other Production data-changing action was executed.
- Deployment scope was Hosting only; no Functions, Firestore Rules, or Storage Rules were deployed.
- Next POS migration: `/pos/payables`.
- No merge to `main`.

---
## 2026-10-04 — Sales History Visual Analytics redesign

Request / design direction:
- User explicitly rejected the plain legacy Sales History presentation and asked for a new modern design directly in code, not a mockup.
- New POS visual policy begins at `/pos/sales`: use stronger information hierarchy, more color, and graphic-rich data visualization while preserving business behavior.

Implementation:
- Reworked `PosSalesPage` into a Visual Analytics dashboard without changing its Firestore source, route, permissions, receipt detail flow, CSV export, or filter semantics.
- Added a dark-green gradient summary Hero with current report period plus net-sales / bill-count / average-bill / highest-bill highlights.
- Rebuilt all 11 existing KPI values as semantic color-coded metric cards with icons and stronger typography.
- Added a real-data sales trend chart derived from the currently filtered sale rows; same-day data groups by hour and multi-day data groups by date.
- Replaced the simple payment progress-only block with a cash-vs-transfer donut graphic plus percentage/progress details.
- Rebuilt best-seller ranking cards with medal-style positions and quantity-relative progress graphics.
- Simplified the desktop sales table into easier visual groups: bill/date, net quantity, payment, VAT summary, discount, net sale, action.
- On mobile, sales rows become responsive receipt cards instead of a wide horizontally scrolling table.
- Preserved all legacy/stable action IDs used by filters, summaries, export, receipt dialog, and regression tests.
- Added `retail-sales-visual-dashboard.css` as the final route stylesheet so this approved redesign intentionally overrides the older parity CSS without changing other POS routes.
- Updated the React foundation contract from old icon-parity assumptions to the approved Visual Analytics structure/responsive contract.
- Updated the POS handoff rule: from Sales History onward, route-specific screens may be intentionally redesigned while business logic, permissions, tenant/data boundaries, actions, export/print, and important stable contracts remain protected.

Release prepared:
- React `0.4.280 / 2026.10.04.393`.
- Public `0.16.32 / 2026.10.04.108`.
- Generated bundle: `/react/assets/index-CSkz0Ktp.js`.

Verification before deploy:
- JSX syntax check through esbuild PASS.
- `node tools/react-foundation-contract.mjs` PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS: migration coverage 53 routes / 21 POS, parity matrix PASS, P0 action contract PASS, callable contract 54 refs / 0 missing, tenant-access PASS, UI-layer PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.393` and `/react/assets/index-CSkz0Ktp.js`.
- `git diff --check` PASS.
- Authenticated local-build browser contract against real Production data/session PASS at 1440x900 and 390x844:
  - Visual dashboard stylesheet loaded.
  - Hero gradient visible.
  - 11 KPI cards visible.
  - Current data produced 2 real sales-trend buckets, 10 ranked products, and 4 sales rows.
  - Payment donut rendered from real payment percentages.
  - No document horizontal overflow on desktop or mobile.
  - Mobile sales row computed as grid/card layout.
  - Today/Clear filters and receipt View/Close interaction passed.
  - Current POS menu remained `/pos/sales`.
  - No raw translation keys, page errors, request errors, or HTTP 4xx/5xx.
- No Production write operation was executed during verification.

Deploy state:
- Implementation commit `89a980a5` — `feat: redesign POS sales analytics` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.04.393` and Public `0.16.32 / 2026.10.04.108`.
- Production `/pos/sales` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-CSkz0Ktp.js`.
- Authenticated Production browser contract PASS at 1440x900 and 390x844: Visual Analytics CSS loaded, gradient Hero visible, 11 KPI cards present, real sales trend bars and payment donut rendered, Top-10 ranking and 4 current sale rows present, zero document horizontal overflow, mobile sale rows render as cards/grid, Today/Clear filters and receipt View/Close passed, current menu remains `/pos/sales`, and no raw translation/page/request/HTTP errors were observed.
- No Production write operation was executed during verification.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, or Functions changes/deploys.
- No merge to `main`.

---
## 2026-10-04 — Sales chart tooltip and mobile receipt-card polish

Request:
- Fix the Sales History bar-chart tooltip being clipped/incomplete.
- Make the mobile receipt number/date header span the full card width.
- Move `ดูบิล` beside the net-sales amount instead of keeping it as a separate full-width row.

Implementation:
- Removed the duplicate native browser `title` tooltip from sales-chart columns and kept one custom tooltip.
- Custom chart tooltip is clamped inside the plot with visible overflow and now renders the localized full amount text such as `2,021.00 บาท`.
- Removed the inherited mobile `max-width:190px` limitation from `.sale-id`; the receipt number/date header now spans the full mobile card.
- Moved the View Bill button into `.sale-amount-group` beside the net-sales amount and removed the standalone action table cell.
- Added regression assertions for tooltip clipping, full-width mobile receipt header, and the grouped net-sales/View Bill action.

Release prepared:
- React `0.4.280 / 2026.10.04.394`.
- Public `0.16.32 / 2026.10.04.109`.
- Generated bundle: `/react/assets/index-DRPvJgwt.js`.

Verification before deploy:
- React foundation contract PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for `.394`.
- `git diff --check` PASS.
- Authenticated local-build browser test using Production data/session PASS.
- Tallest bar tooltip rendered `2,021.00 บาท`, remained inside the chart/viewport, and no duplicate native title remained.
- iPhone 16 Pro Max size 440x956: receipt row width 390px; sale ID/date header width 388px (99.5%), computed max-width `none`; net-sales amount and View Bill button share the same line; no standalone action cell remains.
- Receipt View/Close interaction PASS; no document overflow, page errors, request failures, or HTTP errors.
- No Production write operation was executed.

Deploy state:
- Implementation commit `efe9fe02` — `fix: polish POS sales mobile cards` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.04.394` and Public `0.16.32 / 2026.10.04.109`.
- Production `/pos/sales` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-DRPvJgwt.js`.
- Production contract PASS: tooltip text `2,021.00 บาท` is fully visible inside the chart/viewport with no native duplicate; at 440x956 the 390px receipt row has a 388px full-width bill/date header, net-sales amount and `ดูบิล` share one line, no standalone action cell remains, View Bill still opens, and no document/page/request/HTTP errors were observed.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, or Functions changes/deploys.
- No merge to `main`.

---
## 2026-10-04 — Tax Invoice History Visual Control Center redesign

Request / design direction:
- Continue the new POS visual-design policy after Sales History.
- Redesign `/pos/tax-invoices` directly in code to be more modern, colorful, graphic-rich, and easier to scan while preserving all tax-document behavior.

Implementation:
- Reworked Tax Invoice History into a Tax Document Control Center without changing tenant scope, Firestore collections, document IDs, permissions, legacy tax sync bridge, DBD lookup, buyer profiles, void, print, or recovery behavior.
- Added a dark-green gradient Hero with filtered document amount plus four summary metrics (shown documents, issued, voided, VAT).
- Added a filtered document activity bar chart grouped by recent issue dates.
- Added a sync-health ring calculated from actual invoice health state plus direct visual shortcuts for sync failed / pending / review.
- Kept the original issue-from-receipt workflow but elevated it as a distinct action panel.
- Reworked filter chips, health status, and search controls into clearer control surfaces.
- Reworked tax-document cards into two-column desktop cards with semantic left-edge status colors, visual metadata blocks, stronger total/VAT hierarchy, and compact action controls.
- Mobile collapses the document grid to one column, keeps controls inside the viewport, and changes action buttons to a touch-friendly grid.
- Added `data-tax-status` and `data-tax-sync` presentation attributes only; they do not change business state.
- Added `pos-tax-invoices-visual-dashboard.css` as the final route stylesheet so the redesign intentionally overrides the old visual layout while preserving stable IDs/actions.
- Updated regression contracts for the new Hero, activity chart, sync-health ring, card status attributes, two-column desktop grid, and mobile responsive treatment.

Release prepared:
- React `0.4.280 / 2026.10.04.395`.
- Public `0.16.32 / 2026.10.04.110`.
- Generated bundle: `/react/assets/index-C5i_1B2D.js`.

Verification before deploy:
- Tax Invoice JSX syntax check through esbuild PASS.
- React foundation contract PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS: migration coverage 53 routes / 21 POS, parity matrix PASS, P0 contract PASS, callable contract 54 refs / 0 missing, tenant-access PASS, UI-layer PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.395`.
- `git diff --check` PASS.
- Authenticated local-build browser contract against Production data/session PASS at 1440x900 and 440x956.
- During the browser test, the legacy tax sync module was intercepted with a read-only no-op stub so no pending invoice/profile sync, issue, void, retry, buyer update, or profile write could execute.
- Visual dashboard stylesheet loaded, Hero gradient and four metrics rendered, sync-health conic ring rendered, current menu remained `/pos/tax-invoices`, filter/search behavior passed, and no document horizontal overflow / raw translation / page / request / HTTP errors occurred.
- Current test tenant has zero tax-invoice rows, so timeline bars and real document cards remain in their empty state; their structure/responsive behavior is guarded by source contracts.

Deploy state:
- Implementation commit `8e75ecc4` — `feat: redesign POS tax invoice dashboard` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.04.395` and Public `0.16.32 / 2026.10.04.110`.
- Production `/pos/tax-invoices` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-C5i_1B2D.js`.
- Authenticated Production contract PASS at 1440x900 and 440x956: Visual Control Center CSS loaded, gradient Hero + four metrics + sync-health ring rendered, current menu remained `/pos/tax-invoices`, pending/all filter and empty-search state worked, no document overflow/raw translation/page/request/HTTP errors occurred.
- Production verification intercepted only the legacy tax sync module with read-only no-op functions; no issue/void/retry/profile/sync write operation executed.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, or Functions changes/deploys.
- Next visual redesign route: `/pos/returns`.
- No merge to `main`.

---
## 2026-10-04 — Tax Invoice mobile header action row

Request:
- On Mobile, keep the three Tax Invoice header controls on one line.
- Remove visible button text on Mobile and keep icon-only controls.

Implementation:
- Scoped the change to the Tax Invoice route's Visual Dashboard stylesheet.
- Mobile header now uses a non-wrapping action row for Refresh, Language, and POS Menu.
- Refresh / Language / Menu controls use equal 40x40 touch targets.
- Refresh and POS Menu visible labels are hidden only at <=760px; accessible aria/title labels remain unchanged.
- Desktop keeps the existing Refresh and Menu text.
- Added a regression assertion to protect the one-row icon-only mobile header layout.

Release prepared:
- React `0.4.280 / 2026.10.04.396`.
- Public `0.16.32 / 2026.10.04.111`.
- Generated bundle: `/react/assets/index-BYWswr6j.js`.

Verification before deploy:
- React foundation contract PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated React build contract PASS for Build `.396`.
- `git diff --check` PASS.
- Authenticated local-build browser test at 440x956 PASS using a read-only tax-sync stub.
- Mobile action row metrics: Refresh x=296, Language x=342, Menu x=388; all y=16 and all 40x40; flex-wrap is `nowrap`.
- Refresh/Menu text computed `display:none` on Mobile; desktop text remains visible.
- No document horizontal overflow, page errors, request failures, or HTTP errors.
- No Production tax write/sync operation executed.

Deploy state:
- Implementation commit `2bf35ab3` — `fix: align tax mobile header actions` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.04.396` and Public `0.16.32 / 2026.10.04.111`.
- Production `/pos/tax-invoices` serves `/react/assets/index-BYWswr6j.js`.
- Production 440x956 contract PASS: Refresh x=296, Language x=342, Menu x=388; all y=16 and 40x40, action row is `nowrap`, Refresh/Menu labels are hidden, no document overflow/page/request/HTTP errors.
- Production verification intercepted only the legacy tax sync module with read-only no-op functions; no issue/void/retry/profile/sync write operation executed.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, or Functions changes/deploys.
- No merge to `main`.

---
## 2026-10-04 — Returns & Refund Control Center visual redesign

Request / design direction:
- Continue the user-approved graphic-rich POS redesign policy after Sales History and Tax Invoice History.
- Redesign `/pos/returns` directly in code while preserving all stock, refund, loyalty, VOID, receipt, permission, and tenant behavior.

Implementation:
- Reworked Returns & Refunds into a visual control center without changing `createPosReturnParity`, Firestore transaction boundaries, product stock updates, loyalty ledger, sale refund status, audit logs, or permission/session flow.
- Added a dark-green gradient Hero with total refund amount plus four filtered-history metrics: history count, normal returns, full VOID returns, and returned quantity.
- Added a refund-value activity chart grouped by recent return dates.
- Added a four-segment refund-method ring for cash / transfer / original channel / store credit.
- Added a loyalty-impact strip showing aggregate earned-point deductions and used-point restorations from the filtered history.
- Reworked search-result cards into contained responsive cards; Mobile no longer depends on the old fixed 520px horizontal-scroll card.
- Refined the return editor visual hierarchy while preserving all 21 legacy stable IDs, quantity validation, full-sale VOID helper, loyalty preview, SweetConfirm, barcode scan, and receipt print actions.
- Reworked return history into a two-column desktop card grid with stronger refund/reason/loyalty/item/action hierarchy; Mobile collapses to one column with a full-width receipt action.
- Added `retail-returns-visual-dashboard.css` as the final route stylesheet so the approved redesign intentionally overrides the old visual treatment while preserving underlying behavior.
- Updated React foundation regression contracts for the new Hero, timeline, refund ring, responsive search cards, and history grid.

Release prepared:
- React `0.4.280 / 2026.10.04.397`.
- Public `0.16.32 / 2026.10.04.112`.
- Generated bundle: `/react/assets/index-Brq0G_vR.js`.

Verification before deploy:
- Returns JSX syntax check through esbuild PASS.
- React foundation contract PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS: migration coverage 53 routes / 21 POS, parity matrix PASS, P0 action contract PASS, callable contract 54 refs / 0 missing, tenant-access PASS, UI-layer PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.397`.
- `git diff --check` PASS.
- Authenticated local-build browser contract against Production data/session PASS at 1440x900 and 440x956.
- Visual dashboard CSS loaded; Hero gradient + four metrics + four refund-method rows + two loyalty-impact metrics rendered.
- Current test tenant has zero return-history rows, so the real timeline/history display their empty states. Source regression contracts guard two-column desktop history, one-column Mobile history, and contained search cards.
- History search empty-state, search-mode switch to Product, sale-search empty-state, current POS menu state, and responsive layout passed.
- No document horizontal overflow, raw translation keys, page errors, request failures, or HTTP errors.
- No return, VOID, stock, loyalty, refund, or other Production write operation executed.

Deploy state:
- Implementation commit `b315954c` — `feat: redesign POS returns dashboard` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.04.397` and Public `0.16.32 / 2026.10.04.112`.
- Production `/pos/returns` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-Brq0G_vR.js`.
- Authenticated Production contract PASS at 1440x900 and 440x956: Visual Control Center CSS loaded, gradient Hero + four metrics + refund-method ring + loyalty strip rendered, history/search interactions passed, current menu remained `/pos/returns`, and no document overflow/raw translation/page/request/HTTP errors occurred.
- Current test tenant has zero return-history rows, so activity/history correctly render empty states; their two-column desktop / one-column Mobile structure is guarded by source contracts.
- No return, VOID, stock, loyalty, refund, or other Production write operation executed during verification.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, or Functions changes/deploys.
- Next visual redesign route: `/pos/shifts`.
- No merge to `main`.

---
## 2026-10-04 — Returns lower workflow visual polish and action icons

Request:
- The Returns page still looked too plain from the Loyalty adjustment section downward.
- Several important buttons were still text-only and needed icons.

Implementation:
- Strengthened the Loyalty adjustment strip with a richer violet/blue layered background, stronger icon badge, and icon-bearing deduction/restoration metric chips.
- Elevated the sale-search area into a workflow entry card with a colored side rail, stronger heading badge, raised search controls, richer sale-result cards, and icon-bearing Select Bill actions.
- Added semantic icons to Select Bill, Select New Bill, full-sale VOID, Confirm Return, Return Receipt history action, Close receipt, and Print receipt buttons.
- Reworked the selected-sale editor lower half into card-like form fields with Calendar / Wallet / Reason / Note icons, clearer focus treatments, richer return-quantity inputs, a stronger refund-total summary card, and a more visible loyalty-preview card.
- Restyled VOID as a destructive rose action and Confirm Return as a strong green gradient action while preserving their existing IDs/click handlers and disabled behavior.
- Reworked Return History into a more visual activity board with a colored top rail, rose heading badge, search card, hoverable history cards, richer receipt action, and a graphic empty state.
- Mobile keeps the editor contained at 440px with no document overflow; VOID and Confirm actions use a balanced two-column grid, collapsing to one column on very narrow screens.
- Added regression contracts for the new action icons, editor field icon hierarchy, and lower-workflow visual treatment.

Release prepared:
- React `0.4.280 / 2026.10.04.398`.
- Public `0.16.32 / 2026.10.04.113`.
- Generated bundle: `/react/assets/index-GcRlUtI8.js`.

Verification before deploy:
- Returns JSX syntax check through esbuild PASS.
- React foundation contract PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.398`.
- `git diff --check` PASS.
- Authenticated local-build browser contract against Production data/session PASS at 1440x900 and 440x956.
- Receipt search `POS-` returned 8 real returnable sales; first bill was selected and the editor opened without any write.
- Editor has 4 field cards / 4 field icons; Loyalty strip has 2 metric icons; Select Bill / Select New Bill / VOID / Confirm Return icons are present.
- Entering quantity 1 changed only React state and produced a visible 44.00 refund total; Confirm remained enabled with the new check-circle icon and green gradient; VOID remained available with the rose treatment. No confirm action was clicked.
- At 440x956, editor remained inside the viewport with zero document overflow; first field width 388px; VOID/Confirm render as a two-column grid at 189px each.
- No raw translation keys, page errors, request failures, or HTTP errors.
- No return, VOID, stock, loyalty, refund, receipt-print, or other Production write operation executed.

Deploy state:
- Implementation commit `67b5a082` — `fix: polish POS returns lower workflow` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.04.398` and Public `0.16.32 / 2026.10.04.113`.
- Production `/pos/returns` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-GcRlUtI8.js`.
- Authenticated Production lower-workflow contract PASS at 1440x900 and 440x956: receipt search returned 8 real returnable sales, selected editor opened, 4 field cards / 4 field icons / 2 Loyalty metric icons rendered, Select Bill / Select New Bill / VOID / Confirm icons rendered, summary/history gradients rendered, and no document overflow/raw translation/page/request/HTTP errors occurred.
- Quantity 1 was entered only into React state to verify the visual total and action state (`44.00 บาท`); Confirm used `check2-circle`, VOID used `x-octagon`; neither action was clicked.
- No return, VOID, stock, loyalty, refund, receipt-print, or other Production write operation executed during verification.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, or Functions changes/deploys.
- Next visual redesign route: `/pos/shifts`.
- No merge to `main`.

---
## 2026-10-04 — Returns Loyalty icon centering

Request:
- The purple Loyalty adjustment icon looked too close to the upper-left corner, especially on Mobile.

Root cause:
- The base Loyalty badge defined `display:grid; place-items:center`, but a later generic selector `.returns-loyalty-strip span{display:block}` overrode the badge display because the badge itself is a `span`.
- The lower-workflow polish changed the badge size/gradient but did not restore the grid layout with stronger specificity.

Implementation:
- Restored `.returns-loyalty-icon` to `display:grid!important; place-items:center!important`.
- Fixed it to a 48x48 flex basis, centered it on the row, removed incidental margin, and normalized the inner Bootstrap icon line-height.
- Added a regression contract to protect the centered Loyalty badge layout.

Release prepared:
- React `0.4.280 / 2026.10.04.399`.
- Public `0.16.32 / 2026.10.04.114`.
- Generated bundle: `/react/assets/index-CRrAu_gf.js`.

Verification before deploy:
- React foundation contract PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.399`.
- `git diff --check` PASS.
- Authenticated local-build browser geometry contract PASS at 1440x900 and 440x956.
- Badge measured exactly 48x48 with computed `display:grid`, `align-items:center`, `justify-items:center`.
- Inner icon center offset from badge center: Desktop X=0px / Y≈0.008px; Mobile X=0px / Y≈0.008px.
- No document horizontal overflow, page errors, request failures, or HTTP errors.
- No Production write operation executed.

Deploy state:
- Implementation commit `9001d816` — `fix: center returns loyalty icon` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.04.399` and Public `0.16.32 / 2026.10.04.114`.
- Production `/pos/returns` serves `/react/assets/index-CRrAu_gf.js`.
- Production 440x956 geometry contract PASS: Loyalty badge 48x48, computed `display:grid`, centered alignment, inner icon center offset X=0px / Y≈0.008px, zero document overflow, no page/request/HTTP errors.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, or Functions changes/deploys.
- No merge to `main`.

---
## 2026-10-04 — Returns Loyalty star contrast fix

Request:
- After centering the Loyalty adjustment badge, the star glyph was still too low-contrast on the purple background.

Root cause:
- The generic selector `.returns-loyalty-strip>div:first-child span{color:#806f91!important}` had higher specificity than the badge's parent color and forced the Bootstrap icon glyph to the muted text color.

Implementation:
- Added a higher-specificity rule for the Loyalty badge, icon, and icon `::before` to force `color:#fff!important`.
- Added a subtle purple text shadow to the star so it stays legible across the badge gradient.
- Kept the previous 48x48 centered badge geometry unchanged.
- Added a regression assertion for explicit high-contrast white icon styling.

Release prepared:
- React `0.4.280 / 2026.10.04.400`.
- Public `0.16.32 / 2026.10.04.115`.
- Generated bundle: `/react/assets/index-DhA4-qjk.js`.

Verification before deploy:
- React foundation contract PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.400`.
- `git diff --check` PASS.
- Authenticated local-build browser contrast contract PASS at 1440x900 and 440x956.
- Computed icon color and `::before` color are both exactly `rgb(255, 255, 255)` on Desktop and Mobile.
- Computed text shadow is active, center offset remains X=0px / Y≈0.008px, and no document overflow/page errors occurred.
- No Production write operation executed.

Deploy state:
- Implementation commit `c939e95a` — `fix: improve returns loyalty icon contrast` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.04.400` and Public `0.16.32 / 2026.10.04.115`.
- Production `/pos/returns` serves `/react/assets/index-DhA4-qjk.js`.
- Production 440x956 contrast contract PASS: Loyalty badge/icon/`::before` computed color `rgb(255,255,255)`, text shadow active, center offset X=0px / Y≈0.008px, zero document overflow/page/request/HTTP errors.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, or Functions changes/deploys.
- No merge to `main`.

---
## 2026-10-04 — Staff Shifts Shift Operations Dashboard redesign

Request / design direction:
- Continue the user-approved colorful/graphic-rich POS redesign policy after Returns.
- Redesign `/pos/shifts` directly in React while preserving open/close shift behavior, offline sync, cash calculations, granular permissions, and tenant boundaries.

Implementation:
- Added `retail-shifts-visual-dashboard.css` as the final route stylesheet.
- Added a state-aware Shift Operations Hero:
  - open shift = green live visual state,
  - no active shift = neutral slate closed state.
- Hero shows four permission-safe metrics using current active-shift data when open and history aggregates only when both amount/history permissions allow them.
- Added a recent-shift sales activity bar chart based on the latest closed shifts; bar accents reflect cash difference state.
- Added a cash / transfer sales mix ring using current active-shift totals or permitted history aggregates.
- Preserved `pos.shifts.view_amount` and `pos.shifts.view_history` boundaries so history aggregates cannot leak through Hero/Donut to users without history access.
- Reworked open-shift inputs into visual field cards with Staff / Terminal / Opening Cash / Note icons.
- Reworked active-shift KPI cards with semantic icons and richer cash/sales/bill/expected-cash hierarchy.
- Reworked close-shift fields, cash-difference card, and destructive close action styling without changing IDs, submit handlers, validation, or calculations.
- Reworked Shift History into elevated desktop rows and responsive Mobile cards using `data-label`; Mobile no longer depends on the old 850px horizontal-scroll table/instruction.
- Existing 24 legacy stable IDs, SweetConfirm clear-history action, Toast behavior, gross-sale calculation semantics, shift-id/time fallback, local pending queue, sync conflict handling, and data-layer functions remain unchanged.
- Added regression contracts for the new Hero, trend chart, sales mix ring, field hierarchy, Mobile history cards, and permission boundaries.

Release prepared:
- React `0.4.280 / 2026.10.04.401`.
- Public `0.16.32 / 2026.10.04.116`.
- Generated bundle: `/react/assets/index-oovR8-uT.js`.

Verification before deploy:
- Shifts JSX syntax check through esbuild PASS.
- React foundation contract PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS: 53 routes / 21 POS, parity matrix PASS, P0 action contract PASS, callable contract 54 refs / 0 missing, tenant-access PASS, UI-layer PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.401`.
- `git diff --check` PASS.
- Authenticated local-build browser contract PASS at 1440x900 and 440x956 using a copied browser profile so the primary authenticated profile/local shift cache was not modified.
- Firestore Write-channel / commit / batchWrite endpoints were explicitly blocked during browser verification; blocked write attempts observed: 0.
- Current Production data used by the copied profile has no active shift and 7 closed shift-history rows.
- Hero closed state + 4 metrics rendered; 7 timeline bars rendered from actual history; payment-mix conic ring rendered; current menu remained `/pos/shifts`.
- Open-shift form has 4 field icons; test values `READ ONLY TEST / TEST-01 / 123.45 / visual only` were entered only into copied-profile React state and no submit occurred.
- Desktop Shift History rendered 7 rows; at 440x956 the same 7 rows rendered as contained `display:grid` cards, first card width 386px, table width 386px, document horizontal overflow 0.
- No raw translation keys, page errors, request failures, or HTTP errors.
- No shift open/close/clear-history or other Production write operation executed.

Deploy state:
- Implementation commit `054fc351` — `feat: redesign POS shifts dashboard` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.04.401` and Public `0.16.32 / 2026.10.04.116`.
- Production `/pos/shifts` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-oovR8-uT.js`.
- Authenticated Production contract PASS at 1440x900 and 440x956 using a copied browser profile with Firestore Write-channel / commit / batchWrite endpoints blocked. Blocked write attempts observed: 0.
- Production state during verification: no active shift, 7 closed shift-history rows. Hero closed state + four metrics, 7 real timeline bars, conic payment-mix ring, and current `/pos/shifts` menu state rendered correctly.
- Mobile 440x956 converted all 7 history rows to contained `display:grid` cards; first row/table width 386px; document horizontal overflow 0; no raw translation/page/request/HTTP errors.
- No shift open/close/clear-history or other Production write operation executed.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, or Functions changes/deploys.
- Next visual redesign route: `/pos/products`.
- No merge to `main`.

---
## 2026-10-05 — Shift clear-history persistence + open button icon contrast

Reported:
- The Open Shift & Start Selling button icon was too dark/low-contrast on the green action button.
- Clearing Shift History removed rows only temporarily; leaving/re-entering or reloading `/pos/shifts` restored the same Firestore history.

Root cause:
- The Open Shift action reused `.pos-context-icon` tone styling, so the icon inherited a dark green color on top of the green gradient button.
- `clearLocalPosShiftHistory()` deleted only `retail_pos_shift_history_v1`. On reload, `listPosShiftsParity()` / `watchPosShiftsParity()` read the same closed shifts from Firestore and merged them back into local history.

Implementation:
- Added device-local, tenant-scoped clear watermark key `retail_pos_shift_history_clear_v1`.
- `clearLocalPosShiftHistory(tenantId)` now records the current timestamp for that tenant, clears the local history rows for that tenant, announces the local shift update, and does not delete any Firestore shift document.
- Closed shifts whose close/update timestamp is at or before the tenant's clear watermark are filtered from local history, Firestore/server rows, queued close overlays, server-to-local history merges, and `localShiftHistoryRows()`.
- Open shifts are never filtered by the history clear watermark.
- Any shift closed after the clear watermark remains visible normally, so clearing history is not a permanent blanket hide.
- Added the clear-watermark key to cross-tab storage listeners.
- Forced the Open Shift button icon and glyph `::before` to white with full opacity and a subtle dark-green text shadow.
- Added regression contracts for persistent tenant-scoped clear-history filtering and the high-contrast Open Shift icon.

Release prepared:
- React `0.4.280 / 2026.10.05.402`.
- Public `0.16.32 / 2026.10.05.117`.
- Generated bundle: `/react/assets/index-iid6CYwD.js`.

Verification before deploy:
- `react-app/src/data/retailPosShifts.js` syntax check through esbuild PASS.
- React foundation contract PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.402`.
- `git diff --check` PASS.
- Authenticated local-build browser test used a copied Chrome profile and blocked Firestore Write-channel / commit / batchWrite endpoints.
- Before clear: 8 real closed shift rows and 8 timeline bars were visible.
- Open Shift icon computed color = `rgb(255, 255, 255)` and icon `::before` color = `rgb(255, 255, 255)`; opacity 1; shadow active.
- Clicking Clear History + SweetConfirm in the copied profile reduced history/timeline to 0 and displayed the empty state.
- Local clear state stored a tenant-scoped timestamp in `retail_pos_shift_history_clear_v1`.
- After full page reload, history remained 0 and timeline remained 0; no raw translation or horizontal overflow.
- A synthetic closed shift timestamped one minute after the clear watermark was injected only into the copied profile local history; local Build `.402` showed exactly that one new shift and one timeline bar while keeping all pre-clear server rows hidden.
- No Firestore write attempts, page errors, request failures, or HTTP errors occurred.
- No real shift open/close/clear-server-history operation executed.

Deploy state:
- Implementation commit `9fa96b9d` — `fix: persist cleared POS shift history` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.05.402` and Public `0.16.32 / 2026.10.05.117`.
- Production `/pos/shifts` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-iid6CYwD.js`.
- Authenticated Production clear-history contract PASS using a copied profile with Firestore Write-channel / commit / batchWrite endpoints blocked: 8 visible closed shifts -> Clear History + SweetConfirm -> 0 -> full Reload -> 0.
- Production Open Shift icon computed color and glyph `::before` are both `rgb(255,255,255)` with shadow active.
- A synthetic local shift timestamped after the clear cutoff rendered as the only history row/timeline bar, proving future closed shifts remain visible while pre-clear server history stays hidden.
- Mobile 440x956 remained contained with row width 386px and document horizontal overflow 0; no raw translation/page/request/HTTP errors.
- Firestore write attempts observed: 0. No real shift open/close or server-history deletion occurred.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data deletion.
- Next visual redesign route: `/pos/products`.
- No merge to `main`.

---
## 2026-10-05 — Shift heading icon badge geometry fix

Reported:
- The background badges behind the Shift section heading icons looked squeezed/thin instead of square.

Root cause:
- The route stylesheet declared 42x42 visual badges, but computed layout on Production was 28x42 because the flex item basis was still derived from the icon's intrinsic width.
- Production geometry before the fix:
  - "ยังไม่ได้เปิดกะ" icon badge: 28x42.
  - "ประวัติกะ" icon badge: 28x42.

Implementation:
- Locked both heading icon badges to true square geometry with:
  - `width/height:42px!important`
  - `min-width/min-height:42px!important`
  - `flex:0 0 42px!important`
  - `aspect-ratio:1/1`
- Applied the fix to both `.shift-heading h1 .pos-context-icon` and `.history-head h2 .pos-context-icon`.
- Added a regression contract so future shared `.pos-context-icon` or flex changes cannot compress these badges again.

Release prepared:
- React `0.4.280 / 2026.10.05.403`.
- Public `0.16.32 / 2026.10.05.118`.
- Generated bundle: `/react/assets/index-f4F8tfYx.js`.

Verification before deploy:
- React foundation contract PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.403`.
- `git diff --check` PASS.
- Authenticated local-build browser geometry contract PASS using a copied profile with Firestore writes blocked.
- Desktop:
  - closed-shift heading badge = 42x42, flex `0 0 42px`.
  - history heading badge = 42x42, flex `0 0 42px`.
- Mobile 440x956:
  - both badges remain 42x42 with min-width/min-height 42px and aspect ratio 1/1.
- Document horizontal overflow = 0; Firestore write attempts = 0; no page/request/HTTP errors.

Deploy state:
- Implementation commit `e11ec9db` — `fix: keep shift heading icons square` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.05.403` and Public `0.16.32 / 2026.10.05.118`.
- Production `/pos/shifts` serves `/react/assets/index-f4F8tfYx.js`.
- Production geometry contract PASS at 1440x900 and 440x956: both the closed-shift heading badge and history heading badge measure exactly 42x42 with computed flex `0 0 42px`, min-width/min-height 42px, and aspect ratio 1/1.
- Document horizontal overflow = 0; raw translations = 0; page/request/HTTP errors = 0; Firestore write attempts = 0.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- Next visual redesign route: `/pos/products`.
- No merge to `main`.

---
## 2026-10-05 — Products & Stock Product Command Center redesign

Design direction:
- Continue the user-approved colorful, graphic-rich POS management redesign after Staff Shifts.
- Redesign `/pos/products` without changing the existing 60 stable legacy IDs, CRUD behavior, barcode scanning, drag sorting, stock transactions, permissions, Firestore paths, or tenant boundaries.

Implementation:
- Added route-local `retail-products-visual-dashboard.css` as the final Products presentation layer.
- Replaced the plain four-card summary with a Product & Stock Command Center Hero while preserving:
  - `#productCount`
  - `#stockTotal`
  - `#lowStockCount`
  - `#outStockCount`
- Added Hero context chips for category count, products visible on POS, and products hidden from POS.
- Added permission-neutral inventory retail-value aggregation using current on-hand stock x sale price.
- Added Stock Health conic ring:
  - healthy stock,
  - low stock,
  - out of stock.
- Added Top Category Mix bars for the six largest product categories.
- Added semantic icons to the Hero KPIs, Add Product, Adjust Stock, Edit, Delete, category, sort-manager, and stock-movement headings/actions.
- Reworked the product table into elevated status-aware rows on Desktop:
  - green healthy accent,
  - amber low-stock accent,
  - red out-of-stock accent,
  - product-code pills,
  - barcode icon/text,
  - richer thumbnails and action treatments.
- Added `data-label` to product cells and replaced the legacy 850px Mobile horizontal-scroll table with contained responsive product cards.
- Mobile action buttons collapse to icon-first controls and the legacy “scroll left-right” instruction is suppressed.
- Enhanced Product Categories, catalog sort manager, and stock-adjustment history surfaces so the whole route follows the same visual system instead of only the top section.
- Added Products visual translations for TH / EN / MY / LO / KM.
- Added regression contracts for the Hero, stock-health ring, category bars, semantic icons, translations, and Mobile contained-card layout.

Release prepared:
- React `0.4.280 / 2026.10.05.404`.
- Public `0.16.32 / 2026.10.05.119`.
- Generated bundle: `/react/assets/index-DrUXxFOa.js`.

Verification before deploy:
- Products JSX syntax check through esbuild PASS.
- `parity-translations.json` JSON validation PASS.
- React foundation contract PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS:
  - React migration coverage 53 routes / 21 POS,
  - parity matrix PASS,
  - P0 action contract PASS,
  - callable contract 54 refs / 0 missing,
  - tenant-access PASS,
  - UI-layer PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.404`.
- `git diff --check` PASS.
- Authenticated local-build browser contract PASS at 1440x900 and 440x956 using a copied browser profile with Firestore Write-channel / commit / batchWrite blocked.
- Current Production data used by the copied profile:
  - 1,997 products,
  - total stock 23,687,
  - 0 low-stock products,
  - 0 out-of-stock products,
  - 6 category bars,
  - 20 visible rows on the first product page.
- Desktop: Hero gradient + four KPI cards + Stock Health ring + six category bars rendered; first-page product actions rendered 60 semantic action icons.
- Read-only interaction check:
  - impossible search term showed the existing empty state,
  - Out-of-stock filter returned 0 rows for current data,
  - filters were returned to All.
- Mobile 440x956:
  - same 20 product rows rendered as `display:grid` cards,
  - row width 392px,
  - table width 392px,
  - document horizontal overflow 0.
- No raw translation keys, page errors, request failures, or HTTP errors.
- Firestore write attempts observed: 0.
- No product/category/stock/sort/history write operation executed.

Deploy state:
- Implementation commit `8215a9dd` — `feat: redesign POS products dashboard` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.05.404` and Public `0.16.32 / 2026.10.05.119`.
- Production `/pos/products` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-DrUXxFOa.js`.
- Authenticated Production contract PASS at 1440x900 and 440x956 using a copied browser profile with Firestore Write-channel / commit / batchWrite endpoints blocked.
- Production verification data: 1,997 products, stock total 23,669 at verification time, 0 low-stock, 0 out-of-stock, six category bars, 20 first-page product rows, and 60 first-page semantic row-action icons.
- Read-only impossible-search and Out-of-stock filter checks passed; filters were restored to All.
- Mobile 440x956 rendered the same 20 rows as contained `display:grid` cards with row/table width 392px and document horizontal overflow 0.
- No raw translation keys, page errors, request failures, or HTTP errors. Firestore write attempts observed: 0.
- No product/category/stock/sort/history write operation executed.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- Next visual redesign route: `/pos/stock-movements`.
- No merge to `main`.

---
## 2026-10-05 — Products pagination and editor modal polish

User request:
- Improve the visual spacing around pagination ellipses.
- Default Products page size to 10 and use 10 / 25 / 50 / 100 choices.
- Redesign Add/Edit Product so image upload is a custom drag/drop or click surface instead of a visible native file input.
- Complete action icons in Product/Stock dialogs.
- Redesign Add/Edit Product Category and complete its icons.
- Add an icon to Save Order.

Implementation:
- Changed `PRODUCT_PAGE_SIZES` from 10/20/50/100 to 10/25/50/100.
- Changed the Products initial page size from 20 to 10.
- Added balanced pagination continuation spacing for both Product and Category pagination:
  - 6px control gap,
  - 28px ellipsis footprint on desktop/tablet,
  - 24px on small mobile,
  - subtle background so the continuation marker is visually separated from page buttons.
- Rebuilt `#productDialog` presentation as `.product-editor-dialog` while preserving the existing form IDs and submit logic.
- Added a structured visual title area, semantic Product icon, improved input surfaces, merchandising section treatment, responsive footer actions, and complete Cancel/Save/Remove Image icons.
- Replaced the visible native image file control with `#productImageInput` hidden behind a custom `.product-upload-dropzone`:
  - click the surface to open the file chooser,
  - keyboard Enter/Space support,
  - drag-enter/drag-over/drop handling,
  - image MIME guard,
  - selected filename chip,
  - local image preview,
  - no upload occurs until the existing Save Product flow runs.
- Rebuilt `#categoryDialog` presentation as `.category-editor-dialog` with Category title icon, field icon, information hint card, and complete Cancel/Save icons.
- Added Cancel/Confirm icons to the Adjust Stock dialog for button consistency.
- Added a floppy/save icon to `.sort-save`, with a spinner icon while saving.
- Added regression guards for default page size/options, custom dropzone, Product/Category editor classes/icons, pagination ellipsis styling, and Save Order icon.
- Product/category CRUD, Firestore collection paths, image Storage path, stock transactions, barcode scanner, drag sorting, permissions, and tenant boundaries were not changed.

Release prepared:
- React `0.4.280 / 2026.10.05.405`.
- Public `0.16.32 / 2026.10.05.120`.
- Generated bundle: `/react/assets/index-DTV0vbyr.js`.

Verification before deploy:
- Products JSX esbuild syntax check PASS.
- React foundation contract PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS:
  - migration coverage PASS: 53 routes / 21 POS,
  - parity matrix PASS,
  - P0 action contract PASS,
  - callable contract PASS: 54 refs / 0 missing,
  - tenant-access PASS,
  - UI-layer PASS.
- `npm run build:react` PASS; generated React build contract PASS for Build `.405`.
- `git diff --check` PASS.
- Authenticated local-build browser contract PASS at 1440x900 and 440x956 with Firestore Write-channel / commit / batchWrite blocked.
- Pagination:
  - first page rendered 10 rows,
  - selected page size = 10,
  - choices = 10 / 25 / 50 / 100,
  - Product ellipsis = 28px, 1px side margins, 6px control gap,
  - Category ellipsis = 28px, 1px side margins, 6px control gap.
- Product editor:
  - dialog width = 880px on Desktop,
  - custom dropzone visible,
  - native file input computed display = none,
  - dialog title and footer action icons present,
  - Remove Image icon present.
- Synthetic local image selection `product-preview.png`:
  - selected filename chip appeared,
  - image preview rendered,
  - dropzone entered has-file state,
  - product was NOT saved/uploaded.
- Category editor:
  - dialog width = 560px,
  - title/hint/action icons present.
- Save Order icon present.
- Mobile 440x956:
  - Product dialog left/right = 19px / 421px,
  - width = 402px,
  - dropzone width = 344px,
  - document horizontal overflow = 0.
- Page errors = 0; request failures = 0; HTTP errors = 0.
- Firestore write attempts observed = 0.

Deploy state:
- Implementation commit `6193437c` — `fix: polish POS product editors` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.05.405` and Public `0.16.32 / 2026.10.05.120`.
- Production `/pos/products` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-DTV0vbyr.js`.
- Authenticated Production contract PASS at 1440x900 and 440x956 with Firestore Write-channel / commit / batchWrite blocked.
- Production pagination verification:
  - first page = 10 rows,
  - selected page size = 10,
  - choices = 10 / 25 / 50 / 100,
  - Product and Category ellipses = 28px,
  - both pagination control gaps = 6px.
- Production Product editor:
  - width = 880px Desktop,
  - custom dropzone height = 168px,
  - native input computed display = none,
  - title/footer/remove-image icons present.
- Production Category editor:
  - width = 560px,
  - title/hint/footer icons present.
- Save Order icon present.
- Mobile 440x956 Product editor: left/right = 19px / 421px, width = 402px, dropzone width = 344px, document horizontal overflow = 0.
- Raw translation keys = 0; page errors = 0; request failures = 0; HTTP errors = 0; Firestore write attempts observed = 0.
- No Product/Category/Stock/Sort write operation was executed during verification.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- Next visual redesign route: `/pos/stock-movements`.
- No merge to `main`.

---
## 2026-10-05 — Product editor scrollbar containment

User report:
- The scrollbar on the Add/Edit Product modal visually extended past the rounded modal shell at the lower-right edge.

Root cause:
- The outer native `<dialog>` was still the scrolling element.
- Its scrollbar track rendered against the dialog box itself, so the browser scrollbar visually crossed the rounded border.
- The inner Product form also matched the dialog max-height exactly, leaving its scroll area touching the bottom border by about 1px.

Implementation:
- Set `#productDialog.product-editor-dialog` to `overflow:hidden`.
- Moved vertical scrolling to `.product-editor-form` with:
  - `overflow-y:auto`,
  - `overflow-x:hidden`,
  - `overscroll-behavior:contain`,
  - `scrollbar-gutter:stable`.
- Moved custom WebKit scrollbar styling from the outer dialog to the inner Product/Category editor forms.
- Reduced the inner Product form max-height by 2px relative to the outer dialog:
  - Desktop: dialog `100dvh - 28px`, form `100dvh - 30px`.
  - Mobile: dialog `100dvh - 16px`, form `100dvh - 18px`.
- Kept the Product modal sticky header/footer behavior intact.
- Added regression coverage requiring the scrollbar to live inside the rounded dialog shell.

Release prepared:
- React `0.4.280 / 2026.10.05.406`.
- Public `0.16.32 / 2026.10.05.121`.
- Generated bundle: `/react/assets/index-BlRVV_jM.js`.

Verification before deploy:
- React foundation contract PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS:
  - migration coverage 53 routes / 21 POS,
  - parity matrix PASS,
  - P0 action contract PASS,
  - callable contract 54 refs / 0 missing,
  - tenant-access PASS,
  - UI-layer PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.406`.
- `git diff --check` PASS.
- Authenticated local-build browser contract PASS with Firestore write endpoints blocked.
- Desktop 1440x900:
  - dialog overflow = hidden,
  - Product form overflow-y = auto,
  - scrollbar gutter = stable,
  - dialog bounds = top 14 / bottom 886,
  - inner form bounds = top 15 / bottom 885,
  - form clientHeight = 870 / scrollHeight = 1325,
  - max scroll = 455 and form reached exactly scrollTop 455,
  - sticky header remained at top 15,
  - sticky footer remained inside the dialog,
  - document horizontal overflow = 0.
- Mobile 440x956:
  - dialog bounds = left 19 / right 421 / top 8 / bottom 948,
  - form remains inside at left 20 / right 420,
  - form clientHeight = 938 / scrollHeight = 1607,
  - document horizontal overflow = 0.
- Page errors = 0; request failures = 0; HTTP errors = 0.
- Firestore write attempts observed = 0.

Deploy state:
- Implementation commit `505c08e9` — `fix: contain product modal scrollbar` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.05.406` and Public `0.16.32 / 2026.10.05.121`.
- Production `/pos/products` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-BlRVV_jM.js`.
- Authenticated Production scrollbar contract PASS at 1440x900 and 440x956 with Firestore Write-channel / commit / batchWrite blocked.
- Production Desktop:
  - outer dialog overflow = hidden,
  - inner Product form overflow-y = auto,
  - scrollbar gutter = stable,
  - dialog bottom = 886px,
  - inner scroll form bottom = 885px,
  - form clientHeight / scrollHeight = 870 / 1325,
  - max scroll reached exactly at 455,
  - sticky header/footer remained inside the modal.
- Production Mobile 440x956:
  - dialog bounds = left 19 / right 421 / top 8 / bottom 948,
  - inner form bounds = left 20 / right 420 / top 9 / bottom 947,
  - form clientHeight / scrollHeight = 938 / 1607,
  - document horizontal overflow = 0.
- Page errors = 0; request failures = 0; HTTP errors = 0; Firestore write attempts observed = 0.
- No Product/Category/Stock/Sort write operation was executed during verification.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- Next visual redesign route: `/pos/stock-movements`.
- No merge to `main`.

---
## 2026-10-05 — Product modal footer flush + smooth straight drag sorting

User request:
- Make the Add/Edit Product modal footer (Cancel / Save Product) sit flush against the lower modal edge with no outer whitespace.
- Improve category/product drag sorting because the dragged cards felt jerky and visually tilted.

Root cause:
- The Product editor form still had bottom padding after the previous scrollbar-containment fix, creating a visible gap below the sticky action footer.
- Sortable was still using the legacy motion profile:
  - animation 180ms,
  - fallback tolerance 3,
  - touch threshold 4,
  - no explicit easing/swap profile.
- The legacy sort stylesheet also applied `transform: rotate(1deg)` to `.sort-drag/.sort-fallback`.
- The React visual layer added a transform transition + hover lift on every sort row, which competed with Sortable's own transforms and made reordering feel less stable.

Implementation:
- Product editor footer:
  - changed Product form padding from `0 24px 24px` to `0 24px`,
  - Mobile from `0 14px 14px` to `0 14px`,
  - added a dedicated sticky `.product-editor-actions` footer:
    - bottom 0,
    - negative left/right margin to reach the inner modal edges,
    - internal button padding retained,
    - subtle top divider/shadow,
    - no outer bottom margin.
- Sortable motion:
  - animation = 140ms,
  - easing = `cubic-bezier(0.22, 1, 0.36, 1)`,
  - explicit vertical direction,
  - swap threshold = 0.62,
  - fallback tolerance = 5,
  - touch delay = 100ms,
  - touch start threshold = 5,
  - scroll sensitivity = 80,
  - scroll speed = 12,
  - bubble scrolling retained.
- Drag visuals:
  - removed the hover translateY lift from sort rows,
  - removed transform from normal visual transitions so Sortable owns position transforms,
  - straightened drag/fallback cards (no rotate),
  - replaced the heavy duplicate-style ghost with a soft dashed amber placeholder,
  - kept the active drag card opaque and straight with a lighter shadow,
  - disabled visual transition on the drag/fallback clone so it follows the pointer directly.
- Updated regression contracts from the old legacy exact Sortable profile to the newly user-approved smooth-motion profile while retaining handle/fallback/order semantics.

Release prepared:
- React `0.4.280 / 2026.10.05.407`.
- Public `0.16.32 / 2026.10.05.122`.
- Generated bundle: `/react/assets/index-DPpXgGYq.js`.

Verification before deploy:
- React foundation contract PASS after updating the approved Sortable profile guard.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS:
  - migration coverage 53 routes / 21 POS,
  - parity matrix PASS,
  - P0 actions PASS,
  - callables 54 refs / 0 missing,
  - tenant-access PASS,
  - UI-layer PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.407`.
- `git diff --check` PASS.
- Authenticated local-build browser test PASS with Firestore Write/commit/batchWrite blocked.
- Product editor footer after scrolling to the bottom:
  - dialog bottom = 886,
  - form bottom = 885,
  - footer bottom = 885,
  - visible outer gap = 1px dialog border only,
  - form bottom padding = 0,
  - footer bottom margin = 0.
- Actual category drag test:
  - list count = 50,
  - first two DOM IDs swapped after a real mouse drag/drop,
  - fallback transform matrix had rotation components = 0,
  - opacity = 1,
  - border radius = 12px,
  - transition = none.
- Actual product drag test:
  - list count = 26 in selected real category,
  - first two product IDs swapped after real mouse drag/drop,
  - fallback transform matrix had rotation components = 0,
  - opacity = 1,
  - border radius = 12px,
  - transition = none.
- The test did NOT click Save Order; no order data was persisted.
- Document horizontal overflow = 0.
- Raw translation keys = 0.
- Page errors = 0; request failures = 0; HTTP errors = 0.
- Firestore write attempts observed = 0.

Deploy state:
- Implementation commit `4cc34ec6` — `fix: refine product modal footer and sorting` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.05.407` and Public `0.16.32 / 2026.10.05.122`.
- Production `/pos/products` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-DPpXgGYq.js`.
- Authenticated Production real-drag contract PASS with Firestore Write-channel / commit / batchWrite blocked.
- Production Product editor footer:
  - dialog bottom = 886,
  - form bottom = 885,
  - footer bottom = 885,
  - gap = 1px dialog border only,
  - form bottom padding = 0,
  - footer bottom margin = 0.
- Production category drag:
  - 50 rows,
  - first two category IDs swapped after actual mouse drag/drop,
  - drag transform matrix rotation components = 0,
  - opacity = 1,
  - transition = none,
  - border radius = 12px.
- Production product drag:
  - 26 rows in the selected real category,
  - first two product IDs swapped after actual mouse drag/drop,
  - drag transform matrix rotation components = 0,
  - opacity = 1,
  - transition = none,
  - border radius = 12px.
- Save Order was NOT clicked; no catalog order was persisted.
- Document horizontal overflow = 0; raw translations = 0; page/request/HTTP errors = 0; Firestore write attempts = 0.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- Next visual redesign route: `/pos/stock-movements`.
- No merge to `main`.

---
## 2026-10-05 — Platform Branding dimensions, Login logo, header icon, and legacy Home runtime

User report:
- Uploaded Logo was still too small on the Login page.
- Uploaded App/PWA Icon replaced PG on Order/Delivery pages but looked horizontally cropped.
- The canonical homepage `/` still showed the legacy PG mark.
- Super Admin Branding did not tell the operator what image dimensions/aspect ratios to prepare.

Root cause:
- React Login still used the legacy 64x64 `.login-logo` geometry that had originally been intended for the PG initials. A horizontal logo was therefore reduced to a tiny strip.
- Header `.brand-mark` retained the old 46x38 PG geometry; dynamically inserted square App Icons inherited that non-square box.
- The canonical homepage `/` is still the legacy static page from `public/index.html`, so it never mounts React `PlatformBrandingRuntime`.
- The first static branding subscription could start before Firebase Auth restoration completed, allowing an authenticated Home session to remain on the PG fallback if the branding read was rejected before auth became ready.
- Super Admin showed format/file-size help but no concrete recommended pixel dimensions.

Implementation:
- React `PlatformBrandingRuntime`:
  - Header App Icon target is now an explicit square 42x42 box on desktop with 3px safe padding.
  - Mobile Header App Icon is 36x36 with 2px safe padding.
  - Images remain `object-fit: contain` and are never crop-filled.
  - Login Logo becomes a wide 2:1 surface:
    - Desktop 220x110,
    - Mobile 190x95.
  - Login image width/height/max-width/max-height are explicitly locked to the target and use `object-fit: contain`.
- Added legacy `public/assets/js/platform-branding-runtime.js` for the canonical static Home:
  - consumes `platformSettings/branding`,
  - resolves Storage paths,
  - applies App Icon to `.brand-mark`,
  - updates favicon / Apple touch icon,
  - waits for the first Firebase Auth state before subscribing,
  - retains the PG fallback when no branding exists.
- Loaded the static branding runtime from `public/index.html` with cache key `20261005-123`.
- Super Admin Branding:
  - added a visible recommended-size badge for every asset,
  - changed the Logo preview to a wide 2:1 frame so it no longer previews a horizontal logo in an 88x88 square,
  - all recommendation text is available in TH / EN / MY / LO / KM.
- Recommended source assets:
  - Logo PENGUIN: 1200x600 px, 2:1.
  - Favicon: 128x128 px, 1:1.
  - App / PWA Icon: 512x512 px, 1:1, with 12–15% visual safe area.
- Existing validation remains compatible:
  - Logo PNG/JPG/WebP <= 4 MB.
  - Favicon PNG/ICO <= 2 MB.
  - App Icon remains square and at least 192x192.
- Branding Storage paths, Firestore document path, permissions, and fallback semantics were not changed.

Release prepared:
- React `0.4.280 / 2026.10.05.408`.
- Public `0.16.32 / 2026.10.05.123`.
- Generated bundle: `/react/assets/index-D8ewk-h8.js`.

Verification before deploy:
- Static branding runtime `node --check` PASS.
- `parity-translations.json` JSON validation PASS.
- React foundation contract PASS, including:
  - square contained Header App Icon geometry,
  - wide Login Logo geometry,
  - static Home branding runtime + Auth-ready subscription,
  - Super Admin dimension recommendation UI + five-language labels.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS:
  - migration coverage 53 routes / 21 POS,
  - parity matrix PASS,
  - P0 actions PASS,
  - callables 54 refs / 0 missing,
  - tenant-access PASS,
  - UI-layer PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.408`.
- `git diff --check` PASS.
- Authenticated local-build browser contract PASS against the currently uploaded Production Branding with Firestore write endpoints blocked.
- Current uploaded assets observed:
  - Logo natural size = 2172x1086 (exact 2:1),
  - App Icon natural size = 512x512.
- Desktop:
  - Home `/`: App Icon applied, target 42x42, image 36x36, object-fit contain.
  - Login: Logo target 220x110; image 220x110; object-fit contain.
  - Kitchen: App Icon target 42x42; image 36x36; object-fit contain.
  - Admin: App Icon target 42x42; image 36x36; object-fit contain.
- Mobile 390x844:
  - Login Logo = 190x95.
  - Home App Icon = 36x36 with 32x32 contained image.
  - document horizontal overflow = 0.
- Page errors = 0; request failures = 0; HTTP errors = 0.
- Firestore write attempts observed = 0.

Deploy state:
- Implementation commit `42e9faef` — `fix: align platform branding assets` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.05.408` and Public `0.16.32 / 2026.10.05.123`.
- Production `/login` serves `/react/assets/index-D8ewk-h8.js`; canonical Home `/` serves `/assets/js/platform-branding-runtime.js?v=20261005-123`.
- Authenticated Production branding-geometry contract PASS with the currently uploaded Branding and Firestore Write/commit/batchWrite blocked.
- Production Desktop:
  - Home `/`: App Icon target = 42x42, inner image = 36x36, natural source = 512x512, object-fit contain.
  - Login: Logo target/image = 220x110, natural source = 2172x1086 (2:1), object-fit contain.
  - Kitchen: App Icon target = 42x42, inner image = 36x36, no crop.
  - Admin: App Icon target = 42x42, inner image = 36x36, no crop.
- Production Mobile 390x844:
  - Login Logo = 190x95.
  - Home App Icon = 36x36 with 32x32 contained image.
  - document horizontal overflow = 0.
- Home confirms the static Branding runtime is active and no longer remains PG-only when Branding exists.
- Page errors = 0; request failures = 0; HTTP errors = 0; Firestore write attempts observed = 0.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- No Branding settings were changed during verification; existing uploaded assets were read only.
- Next visual redesign route: `/pos/stock-movements`.
- No merge to `main`.

---
## 2026-10-05 — POS Stock Movements Visual Control Center

User request:
- Continue the approved Retail POS redesign plan after Products.
- Next route in the plan: `/pos/stock-movements`.
- Keep the page modern, colorful, easy to scan, and richer in visual/graphic information rather than a plain report table.

Design / implementation:
- Kept the existing React route, Firestore readers/watchers, movement classification, filters, CSV export, barcode filter scanner, permissions, tenant isolation, and all legacy IDs intact.
- Added `retail-stock-movements-visual-dashboard.css` as a React-only visual layer; the Laravel/legacy MASTER CSS remains untouched.
- Added a green Stock Flow Control Center hero with:
  - current report period,
  - movement count,
  - number of products with movement,
  - dominant movement type,
  - largest absolute stock change.
- Added a visual filter card with result count while preserving:
  - keyword search,
  - date from/to,
  - type filter,
  - Today / This Month / All shortcuts.
- Rebuilt the four existing KPI summaries as colored cards with semantic icons:
  - movement count,
  - stock in,
  - stock out,
  - net change.
- Added an Activity chart from the already-loaded filtered movement rows:
  - same-day data buckets by hour,
  - multi-day data buckets by day,
  - last eight visible buckets,
  - counts movements only and therefore does not reveal stock quantities.
- Added Movement Mix graphics that show event count by movement type.
- Added a quantity-derived flow-balance graphic only when `pos.stock_movements.view_quantity` is available.
- Added visual permission masking:
  - largest-change value shows `—` without quantity permission,
  - flow-balance total shows `—` without quantity permission,
  - existing `movementIn / movementOut / movementNet` controls retain their original `hidden={!canViewQuantity}` behavior.
- Restyled the report area:
  - semantic report icon,
  - dedicated product/barcode filter surface,
  - movement type icons,
  - colored row accents by purchase/sale/return/count/adjustment,
  - richer date/product hierarchy,
  - graphical empty state.
- Mobile:
  - hero/KPIs reflow without horizontal scroll,
  - insight panels stack vertically,
  - CSV becomes icon-only,
  - barcode scanner becomes icon-only,
  - movement table keeps the approved card layout with colored type accent.
- Added TH / EN / MY / LO / KM labels for the new Visual Control Center surfaces.

Important files:
- `react-app/src/pages/PosStockMovementsPage.jsx`
- `react-app/public/parity/css/retail-stock-movements-visual-dashboard.css`
- `react-app/src/i18n/parity-translations.json`
- `tools/react-foundation-contract.mjs`
- release metadata files.

Behavior/data boundary:
- No Stock Movement write logic changed.
- No Firestore collection/schema/index/rule change.
- Movement type detection remains the exact legacy note-based logic.
- Before/after/delta math remains unchanged.
- Realtime `stockMovements` and `products` watchers remain unchanged.
- CSV behavior/file naming remains unchanged.
- BarcodeDetector + ZXing fallback remains unchanged.
- Page-level and granular POS permissions remain unchanged.
- No merge to `main`.

Release prepared:
- React `0.4.280 / 2026.10.05.409`.
- Public `0.16.32 / 2026.10.05.124`.
- Generated bundle: `/react/assets/index-IjrAvTJl.js`.

Verification before deploy:
- Stock Movements JSX esbuild syntax check PASS.
- Translation JSON validation PASS.
- React foundation contract PASS, including new visual structure, responsive CSS, semantic icons, five-locale labels, and quantity-permission masking.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS:
  - migration coverage = 53 routes / 21 POS,
  - parity matrix PASS,
  - P0 actions PASS,
  - callables = 54 refs / 0 missing,
  - tenant-access PASS,
  - UI-layer PASS.
- `npm run build:react` PASS and generated build contract PASS for Build `.409`.
- `git diff --check` PASS.
- Authenticated local-build browser contract PASS using current Production Firestore data with Firestore write endpoints blocked.
- Desktop 1440x900:
  - hero height ~= 247px,
  - four hero metrics,
  - four KPI cards,
  - 3 activity buckets in current data (29 Sep / 04 Oct / 05 Oct),
  - 89 current filtered movement rows,
  - Movement Mix rendered,
  - barcode filter present,
  - CSV action visible for authorized user,
  - raw translation keys = 0,
  - document horizontal overflow = 0.
- Mobile 390x844:
  - hero rendered,
  - four KPI cards,
  - insight grid stacks to one column,
  - report width = 374px,
  - movement card width = 348px,
  - movement table min-width = 0,
  - table wrapper overflow = visible,
  - scanner and CSV labels collapse to icon-only,
  - document horizontal overflow = 0.
- Page errors = 0; request failures = 0; HTTP errors = 0.
- Firestore write attempts observed = 0.

Deploy state:
- Implementation commit `13eb7b36` — `feat: redesign POS stock movements` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.05.409` and Public `0.16.32 / 2026.10.05.124`.
- Production `/pos/stock-movements` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-IjrAvTJl.js`.
- Authenticated Production visual contract PASS with Firestore Write/commit/batchWrite blocked.
- Production Desktop 1440x900:
  - hero height ~= 247px,
  - four hero metrics,
  - four KPI cards,
  - 3 activity bars,
  - Movement Mix rendered,
  - 89 movement rows,
  - barcode filter present,
  - CSV action visible for authorized user,
  - raw translation keys = 0,
  - document horizontal overflow = 0.
- Production Mobile 390x844:
  - hero rendered,
  - four KPI cards,
  - report width = 374px,
  - movement card width = 348px,
  - table min-width = 0,
  - table wrapper overflow = visible,
  - scanner and CSV labels collapse to icon-only,
  - document horizontal overflow = 0.
- Page errors = 0; request failures = 0; HTTP errors = 0; Firestore write attempts observed = 0.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- Next visual redesign route: `/pos/stock-counts`.
- No merge to `main`.

---
## 2026-10-05 — POS Stock Counts Visual Control Center

User request:
- Continue the approved Retail POS visual redesign plan after Stock Movements.
- Next route: `/pos/stock-counts`.
- Keep the screen graphic-rich, colorful, easy to scan, responsive, while preserving all stock-count behavior.

Design / implementation:
- Preserved the existing React Stock Counts route, all 21 legacy IDs, count inputs, scanner, realtime watchers, permission gates, confirmation flow, Firestore commit payload, and tenant scope.
- Added React-only `retail-stock-counts-visual-dashboard.css`; legacy MASTER CSS remains untouched.
- Added a green Stock Count Control Center hero with safe/non-monetary live metrics:
  - total product catalog count,
  - products counted,
  - products remaining,
  - counted products with variance.
- Added Count Progress visualization:
  - conic progress ring,
  - counted vs remaining legend,
  - updates only from the existing in-memory `actuals` state.
- Added Variance Overview:
  - shortage quantity,
  - overage quantity,
  - split variance bar,
  - net variance monetary value only when `pos.stock_counts.view_value` is available; otherwise displays `—`.
- Reworked the existing count workspace visually:
  - richer title/action area,
  - grouped count metadata fields,
  - stronger search/barcode/filter surface,
  - row accents for uncounted / matching / shortage / overage states,
  - actual-count input remains the same editable control,
  - graphical empty state.
- Rebuilt the four existing summary values as visual metric cards with semantic icons while preserving IDs:
  - `countedItems`,
  - `shortQty`,
  - `overQty`,
  - `varianceValue`.
- Preserved `varianceValue hidden={!canViewValue}` and added only a visual `—` mask for unauthorized users.
- Reworked history visually:
  - clock-history title icon,
  - visible filtered-history count,
  - balanced/difference accent cards,
  - graphical empty state.
- Preserved the entire history section `hidden={!canViewHistory}`.
- Mobile:
  - Hero and metrics reflow,
  - insight panels stack,
  - count table remains card layout with status accent,
  - actual-count input remains prominent and usable,
  - summary cards use a compact 2-column layout,
  - history cards remain contained,
  - no horizontal scrolling.
- Added new Visual Control Center labels in TH / EN / MY / LO / KM.

Behavior / data boundary:
- `commitRetailStockCount()` was not changed.
- Required-field validation, at-least-one-actual validation, and `sweetConfirm` flow are unchanged.
- Count IDs, translated movement notes, product legacy document IDs, stock adjustment behavior, and rules-compatible adjustment movement type are unchanged.
- `watchRetailProducts` and `watchRetailStockCounts` are unchanged.
- BarcodeDetector + ZXing fallback is unchanged.
- `pos.stock_counts.perform`, `pos.stock_counts.view_value`, `pos.stock_counts.view_history`, and page permission behavior are unchanged.
- No Firestore schema/index/rules/storage/functions changes.
- No merge to `main`.

Release prepared:
- React `0.4.280 / 2026.10.05.410`.
- Public `0.16.32 / 2026.10.05.125`.
- Generated bundle: `/react/assets/index-B_FUnTNp.js`.

Verification before deploy:
- Stock Counts JSX esbuild syntax PASS.
- Translation JSON validation PASS.
- React foundation contract PASS, including:
  - visual control-center structure,
  - responsive CSS,
  - semantic icons,
  - five-language visual translations,
  - `view_value` masking,
  - `view_history` boundary.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS:
  - migration coverage = 53 routes / 21 POS,
  - parity matrix PASS,
  - P0 actions PASS,
  - callables = 54 refs / 0 missing,
  - tenant-access PASS,
  - UI-layer PASS.
- `npm run build:react` PASS; generated React build contract PASS for Build `.410`.
- `git diff --check` PASS.
- Authenticated local-build browser contract PASS against current Production Firestore data with all Firestore write endpoints blocked.
- Desktop 1440x900:
  - Hero height ~= 243px,
  - 4 Hero metrics,
  - 2 insight panels,
  - Progress ring = 164x164,
  - Product metrics = 1,997 total / 0 counted / 1,997 remaining / 0 variance at initial untouched state,
  - 1,997 product rows loaded,
  - actual inputs with a value = 0,
  - 4 summary cards,
  - history permission is available for current owner account; current history cards = 0,
  - barcode scanner button present,
  - confirm action present but NOT clicked,
  - raw translation keys = 0,
  - document horizontal overflow = 0.
- Mobile 390x844:
  - Hero rendered,
  - insight grid stacks to one column,
  - count panel = 374px,
  - product card = 348px,
  - table min-width = 0,
  - table wrapper overflow = visible,
  - 4 summary cards,
  - actual input = 122px,
  - history grid = 348px,
  - document horizontal overflow = 0.
- No input was entered, no Fill System/Clear/Reset/Confirm action was clicked.
- Page errors = 0; request failures = 0; HTTP errors = 0.
- Firestore write attempts observed = 0.

Deploy state:
- Implementation commit `ff93c131` — `feat: redesign POS stock counts` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.05.410` and Public `0.16.32 / 2026.10.05.125`.
- Production `/pos/stock-counts` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-B_FUnTNp.js`.
- Authenticated Production visual contract PASS with Firestore Write/commit/batchWrite blocked.
- Production Desktop 1440x900:
  - Hero ~= 243px,
  - 4 Hero metrics,
  - 2 insight panels,
  - Progress ring = 164x164,
  - metrics = 1,997 total / 0 counted / 1,997 remaining / 0 variance at untouched state,
  - 1,997 product rows,
  - actual inputs with a value = 0,
  - 4 summary cards,
  - history permission available; current history cards = 0,
  - raw translation keys = 0,
  - document horizontal overflow = 0.
- Production Mobile 390x844:
  - Hero rendered,
  - count panel = 374px,
  - product card = 348px,
  - table min-width = 0,
  - table overflow = visible,
  - actual input = 122px,
  - history grid = 348px,
  - document horizontal overflow = 0.
- No input/action that changes count state was used during verification.
- Page errors = 0; request failures = 0; HTTP errors = 0; Firestore write attempts observed = 0.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- Next visual redesign route: `/pos/purchases`.
- No merge to `main`.

---
## 2026-10-05 — POS Purchases / Receiving Visual Control Center

User request:
- Continue the approved Retail POS redesign plan after Stock Counts.
- Next route: `/pos/purchases`.
- Make the receiving/purchase screen modern, colorful, graphic-rich, easy to scan, and mobile friendly while preserving all purchase/stock logic.

Design / implementation:
- Preserved the existing React Purchases route, all legacy IDs/actions, realtime Firestore readers, supplier/product watchers, scanner, CSV export, create permission, cost permission, and tenant boundary.
- Added React-only `retail-purchases-visual-dashboard.css`; the legacy Purchases MASTER CSS remains intact underneath.
- Added a Purchase & Receiving Control Center hero with:
  - purchase count,
  - total received quantity,
  - supplier count,
  - grand total only when `pos.purchases.view_cost` is allowed,
  - catalog-ready indicator using the already-loaded product catalog.
- Reworked the receiving form visually:
  - semantic receiving icon/title,
  - active line-count badge,
  - grouped supplier/invoice/date/note fields,
  - stronger add-product/barcode actions,
  - richer line table,
  - semantic remove control,
  - contained total/clear/save actions.
- Purchase lines keep the original editable controls and default behavior:
  - initial form still contains exactly one blank line,
  - that blank line keeps legacy default `qty: 1`,
  - no product is selected until the user chooses/scans one.
- Mobile line table becomes contained visual cards:
  - product selector full width,
  - stock/qty/cost/total labels exposed through `data-label`,
  - scanner and Add Product buttons become icon-only,
  - no horizontal page overflow.
- Reworked the purchase report:
  - visual report heading/result badge,
  - date/month/all/CSV filters retained,
  - four KPI cards,
  - daily purchase-receipt activity chart based only on the already-loaded `reportRows`,
  - top supplier ranking remains hidden without `view_cost`,
  - top product ranking remains quantity based,
  - no extra Firestore query added.
- Reworked history:
  - semantic history heading and count badge,
  - richer receiving cards,
  - graphical empty state.
- Added TH / EN / MY / LO / KM labels for the new visual surfaces.

Permission/data safety:
- Hero grand total is `canViewCost ? amountText(reportStats.grandTotal) : "—"`.
- Cost KPI, purchase grand total, supplier value ranking, line unit cost/line total, history totals and CSV cost export remain behind the existing `pos.purchases.view_cost` boundary.
- Count/quantity/supplier-count/activity visuals do not derive from hidden cost values.
- `pos.purchases.create` visibility/disabled behavior remains unchanged.
- BarcodeDetector + ZXing fallback remains unchanged.
- `watchRetailProducts`, `watchPosSuppliers`, and `watchPosPurchases` remain unchanged.
- Purchase IDs, supplier credit fields, payable reference fields, stock movement purchase references, legacy product document IDs, and Firestore transaction read-before-write behavior remain unchanged.
- No Firestore schema/index/rules/storage/functions changes.
- No merge to `main`.

Release prepared:
- React `0.4.280 / 2026.10.05.411`.
- Public `0.16.32 / 2026.10.05.126`.
- Generated bundle: `/react/assets/index-CuLqseIF.js`.

Verification before deploy:
- Purchases JSX esbuild syntax PASS.
- Translation JSON validation PASS.
- React foundation contract PASS, including:
  - Purchase Control Center structure,
  - `view_cost` masking,
  - responsive mobile card CSS,
  - semantic icons,
  - five-language visual labels.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS:
  - migration coverage = 53 routes / 21 POS,
  - parity matrix PASS,
  - P0 actions PASS,
  - callables = 54 refs / 0 missing,
  - tenant-access PASS,
  - UI-layer PASS.
- `npm run build:react` PASS; generated React build contract PASS for Build `.411`.
- `git diff --check` PASS.
- Authenticated local-build browser contract PASS against current Production Firestore data with Firestore Write/commit/batchWrite blocked.
- Current report range/data has 0 purchase receipts:
  - Hero values = 0 purchases / 0 received qty / 0 suppliers / 0.00 amount for current authorized owner.
  - Activity chart correctly renders the empty state.
  - Supplier/Product rankings correctly render empty.
  - History currently contains 0 cards.
- Form untouched state:
  - 1 default purchase line,
  - selected products = 0,
  - default qty value = 1 (legacy `createLine()` behavior),
  - no form actions clicked.
- Desktop 1440x900:
  - Hero ~= 243px,
  - 4 Hero metrics,
  - 4 visible report KPI cards for current cost-authorized owner,
  - scanner present,
  - CSV action visible for current cost-authorized owner,
  - raw translation keys = 0,
  - document horizontal overflow = 0.
- Mobile 390x844:
  - Hero ~= 334px,
  - form panel = 374px,
  - purchase line card = 348px,
  - table min-width = 0,
  - table wrapper overflow = visible,
  - purchase line display = grid,
  - scanner/Add Product labels collapse to icon-only,
  - report KPI layout = 2 columns,
  - history layout = 1 contained column,
  - document horizontal overflow = 0.
- Page errors = 0; request failures = 0; HTTP errors = 0.
- Firestore write attempts observed = 0.

Deploy state:
- Implementation commit `2478d4ac` — `feat: redesign POS purchases` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.05.411` and Public `0.16.32 / 2026.10.05.126`.
- Production `/pos/purchases` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-CuLqseIF.js`.
- Authenticated Production visual contract PASS with Firestore Write/commit/batchWrite blocked.
- Production Desktop 1440x900:
  - Hero ~= 243px,
  - 4 Hero metrics,
  - current report values = 0 purchases / 0 received qty / 0 suppliers / 0.00 amount,
  - one untouched default purchase line with no selected product and qty = 1,
  - 4 visible report KPI cards for current cost-authorized owner,
  - activity/rankings/history correctly show empty state for current data,
  - barcode scanner present,
  - CSV visible for current cost-authorized owner,
  - raw translation keys = 0,
  - document horizontal overflow = 0.
- Production Mobile 390x844:
  - Hero ~= 334px,
  - form panel = 374px,
  - purchase line card = 348px,
  - table min-width = 0,
  - table wrapper overflow = visible,
  - purchase line display = grid,
  - scanner/Add Product labels collapse to icon-only,
  - report KPI layout = 2 columns,
  - history layout = 1 contained column,
  - document horizontal overflow = 0.
- No purchase form action was used during verification.
- Page errors = 0; request failures = 0; HTTP errors = 0; Firestore write attempts observed = 0.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- Next Retail POS migration/redesign route: `/pos/payables`.
- No merge to `main`.

---
## 2026-10-05 — POS Payables canonical React migration + Accounts Payable Control Center

User request:
- Continue the Retail POS plan after Purchases.
- Next remaining route: `/pos/payables`.
- Migrate the legacy page to canonical React and apply the approved modern/colorful Control Center visual policy without changing payable business behavior.

Legacy behavior recovered before migration:
- Legacy page IDs/actions were read from `public/pos/payables/index.html` and retained.
- Legacy payable normalization:
  - supplier lookup by supplier ID or normalized name,
  - credit days fall back from purchase -> supplier -> 0,
  - paid amount is summed from payment history when payments exist, otherwise legacy `paidAmount` is used,
  - balance = max(0, total - paid),
  - due date falls back to purchase date + supplier credit days,
  - status = paid / partial / unpaid.
- Due-soon = open balance and due in 0–7 days.
- Overdue = open balance and due date before today.
- Search/filter rows are sorted by due date.
- Supplier summary ranks the top 8 open balances.
- Payment form validates amount > 0 and no more than the current outstanding balance.
- Granular permissions:
  - `pos.payables.pay`,
  - `pos.payables.view_amount`.
- Legacy permission boundary:
  - payment actions hidden without `pay`,
  - outstanding/due-soon/overdue/supplier-balance and amount columns hidden without `view_amount`.

Migration / implementation:
- Replaced the minimal draft `PosPayablesPage.jsx` with a full canonical React implementation.
- Added production POS session/page-guard behavior:
  - `getRetailPosSession()`,
  - `canUseRetailPos()`,
  - cached role settings,
  - 6s bounded role-settings load,
  - first-allowed-route redirect,
  - 10s bounded initial data load,
  - shared PageReady overlay.
- Added realtime Firestore watchers:
  - `watchPosPurchases`,
  - `watchPosSuppliers`.
- Initial load uses `listPosPurchases` + `listPosSuppliers`.
- React normalization preserves the legacy supplier-credit/payment-history compatibility rules described above.
- Payable payment still calls the existing `recordPosPayablePayment()` transaction in `retailPurchasingData.js`; no write/business logic was moved or rewritten.
- Added safe granular-permission fallback consistent with the old POS role model:
  - owner / wildcard = allowed,
  - explicit granular roles are respected exactly,
  - manager/admin with no granular payable entries retain old default pay + view-amount capabilities.
- Important privacy boundary:
  - without `view_amount`, all amount KPI/table/supplier-ranking surfaces are hidden or masked,
  - a user with `pay` but without `view_amount` gets an empty payment amount field rather than a prefilled outstanding balance,
  - internal balance remains available only for submission validation.
- Preserved legacy DOM/action IDs:
  - `payableOutstanding`, `payableOpenCount`, `payableDueSoon`, `payableOverdue`,
  - `payableSearch`, `payableStatusFilter`, `supplierPayableSummary`,
  - `payableTableBody`, `payableEmpty`,
  - `paymentDialog`, `supplierPaymentForm`, `paymentPurchaseId`, `paymentPurchaseInfo`,
  - `supplierPaymentDate`, `supplierPaymentAmount`, `supplierPaymentMethod`,
  - `supplierPaymentReference`, `supplierPaymentNote`, `supplierPaymentError`,
  - `closePaymentDialog`, `cancelPaymentBtn`, `toast`.
- Added canonical React shell sync for `public/pos/payables/index.html`.
- Added no-cache Hosting headers for `/pos/payables` and `/pos/payables/**`.

Visual redesign:
- Added React-only `retail-payables-visual-dashboard.css`.
- Added Accounts Payable Control Center hero:
  - outstanding amount when permitted,
  - open purchase count,
  - due-soon count,
  - overdue count,
  - open-supplier count.
- Added four colored KPI cards.
- Added Due-Date Risk visualization based on counts only:
  - overdue,
  - due within 7 days,
  - due later.
- Added supplier outstanding ranking only when `view_amount` is allowed.
- Added richer search/status filters.
- Added status/risk-accent payable rows and semantic icons.
- Mobile payable table becomes contained cards with no horizontal page scroll.
- Rebuilt payment dialog with:
  - semantic title/info card,
  - icon-labelled payment fields,
  - internal responsive layout,
  - contained footer actions.
- Added TH / EN / MY / LO / KM visual labels.

Important files:
- `react-app/src/pages/PosPayablesPage.jsx`
- `react-app/public/parity/css/retail-payables-visual-dashboard.css`
- `react-app/src/i18n/parity-translations.json`
- `tools/react-foundation-contract.mjs`
- `tools/sync-react-legacy-entrypoints.py`
- `firebase.json`
- release metadata files after Build bump.

Release prepared:
- React `0.4.280 / 2026.10.05.412`.
- Public `0.16.32 / 2026.10.05.127`.
- Generated bundle: `/react/assets/index-DNK0e-Xk.js`.

Verification before deploy:
- Payables JSX esbuild syntax PASS.
- Translation JSON validation PASS.
- React foundation contract PASS, including:
  - all legacy IDs,
  - session/role/page permission behavior,
  - legacy supplier-credit/payment-history normalization,
  - realtime watchers,
  - `pay` / `view_amount` permission boundaries,
  - no balance prefill without `view_amount`,
  - five-language labels,
  - responsive visual CSS,
  - canonical shell sync,
  - Hosting no-cache headers.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS:
  - migration coverage = 53 routes / 21 POS,
  - parity matrix PASS,
  - P0 actions PASS,
  - callables = 54 refs / 0 missing,
  - tenant-access PASS,
  - UI-layer PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.412`.
- `git diff --check` PASS.
- Authenticated local-build browser contract PASS against Production Firestore with Firestore Write/commit/batchWrite blocked.
- Current Production data has 0 payable rows:
  - Hero = 0.00 amount / 0 open / 0 due soon / 0 overdue for current owner.
  - Supplier ranking correctly renders empty.
  - Payable list correctly renders empty state.
- Desktop 1440x900:
  - Hero ~= 247px,
  - 4 Hero metrics,
  - 4 KPI cards,
  - 3 risk bars,
  - all 22 legacy IDs present,
  - amount surfaces visible for current owner,
  - Payment dialog = 680x532,
  - dialog amount is empty when opened without a selected payable,
  - raw translation keys = 0,
  - horizontal overflow = 0.
- Mobile 390x844:
  - Hero ~= 332px,
  - Payables panel = 374px,
  - table min-width = 0,
  - table display = block/mobile cards,
  - wrapper overflow = visible,
  - payment dialog = 374px wide and contained,
  - horizontal overflow = 0.
- Payment dialog was opened for layout inspection only; no submit/payment action was performed.
- Page errors = 0; request failures = 0; HTTP errors = 0.
- Firestore write attempts observed = 0.

Deploy state:
- Implementation commit `7bc34c25` — `feat: migrate POS payables to React` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.05.412` and Public `0.16.32 / 2026.10.05.127`.
- Production `/pos/payables` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-DNK0e-Xk.js`.
- Authenticated Production visual contract PASS with Firestore Write/commit/batchWrite blocked.
- Production Desktop 1440x900:
  - Hero ~= 247px,
  - 4 Hero metrics,
  - values = 0.00 amount / 0 open / 0 due soon / 0 overdue for current owner,
  - 4 KPI cards,
  - 3 due-risk bars,
  - current payable rows = 0 and empty state visible,
  - amount surfaces visible for current owner,
  - Payment dialog = 680x532,
  - raw translation keys = 0,
  - document horizontal overflow = 0.
- Production Mobile 390x844:
  - Hero ~= 332px,
  - Payables panel = 374px,
  - table min-width = 0,
  - table display = mobile block/card mode,
  - wrapper overflow = visible,
  - Payment dialog = 374px wide and contained,
  - document horizontal overflow = 0.
- Modal was opened only for layout verification; no payment was submitted.
- Page errors = 0; request failures = 0; HTTP errors = 0; Firestore write attempts observed = 0.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- Next Retail POS migration/redesign route: `/pos/suppliers`.
- No merge to `main`.

---
## 2026-10-05 — POS Suppliers canonical React migration + Supplier Control Center

User request:
- Continue the Retail POS migration/redesign plan after Payables.
- Next remaining route: `/pos/suppliers`.
- Preserve supplier CRUD and purchasing behavior while applying the approved colorful Control Center design.

Legacy behavior recovered/preserved:
- Supplier directory reads supplier master data and purchase history.
- “With purchase history” status is derived from matching purchases by:
  - supplier ID, or
  - normalized supplier name.
- Filters remain:
  - all,
  - with purchase history,
  - no purchase history.
- Duplicate supplier names are rejected case-insensitively.
- Supplier deletion is blocked when any purchase history exists.
- Credit days remain a non-negative numeric field and continue feeding purchase/payable behavior.
- Granular permissions remain:
  - `pos.suppliers.create`,
  - `pos.suppliers.edit`,
  - `pos.suppliers.delete`,
  - `pos.suppliers.view_purchase`.

Migration / implementation:
- Expanded `PosSuppliersPage.jsx` from the minimal draft to a complete canonical React implementation.
- Added POS session/page guard parity:
  - `getRetailPosSession()`,
  - `canUseRetailPos()`,
  - cached role rows,
  - 6s bounded role-settings wait,
  - first-allowed-route redirect,
  - 10s bounded initial data load,
  - shared PageReady overlay.
- Added realtime Firestore watchers:
  - `watchPosSuppliers`,
  - `watchPosPurchases`.
- Initial load still uses:
  - `listPosSuppliers`,
  - `listPosPurchases`.
- Supplier save/delete continue to call the existing shared data layer:
  - `savePosSupplier`,
  - `deletePosSupplier`.
- Replaced native confirm/alert destructive flow with shared centered `sweetConfirm` / `sweetAlert` while keeping the same business rules.
- Added typed global Toast feedback.
- Preserved all 25 legacy supplier IDs:
  - `supplierTotal`, `activeSupplierTotal`, `supplierPurchaseTotal`, `supplierPurchaseCount`,
  - `addSupplierBtn`, `supplierSearch`, `supplierFilter`, `supplierGrid`, `supplierEmpty`,
  - `supplierDialog`, `supplierForm`, `supplierDialogTitle`, `editingSupplierId`,
  - `supplierName`, `supplierContact`, `supplierPhone`, `supplierEmail`, `supplierTaxId`,
  - `supplierCreditDays`, `supplierAddress`, `supplierNote`, `supplierFormError`,
  - `closeSupplierDialog`, `cancelSupplierBtn`, `toast`.
- Added canonical React shell sync for `public/pos/suppliers/index.html`.
- Added no-cache Hosting headers for `/pos/suppliers` and `/pos/suppliers/**`.

Visual redesign:
- Added React-only `retail-suppliers-visual-dashboard.css`.
- Added Supplier Control Center Hero:
  - total suppliers,
  - suppliers with purchase history,
  - average credit days,
  - purchase count when permitted.
- Added four colored KPI cards.
- Purchase-derived monetary/count surfaces remain hidden/masked without `pos.suppliers.view_purchase`.
- Rebuilt supplier directory cards with:
  - semantic supplier avatar,
  - purchase-history status badge,
  - contact/phone/email/address icons,
  - credit-term strip,
  - permission-aware purchase summary,
  - edit/delete action icons.
- Added richer search and purchase-history filter controls.
- Added graphical empty state.
- Rebuilt Supplier editor dialog:
  - semantic title icon,
  - icon-prefixed fields,
  - contained internal scrollbar,
  - responsive two-column desktop / one-column mobile form,
  - centered cancel/save actions.
- Added TH / EN / MY / LO / KM labels for new visual surfaces.

Behavior/data boundary:
- No Firestore collection/schema/index/rule changes.
- No supplier CRUD transaction logic was rewritten.
- Purchase history matching remains legacy-compatible.
- Supplier deletion still refuses suppliers used by purchase history.
- Purchase-derived UI remains behind `view_purchase`.
- Tenant boundaries remain unchanged.
- No merge to `main`.

Release prepared:
- React `0.4.280 / 2026.10.05.413`.
- Public `0.16.32 / 2026.10.05.128`.
- Generated bundle: `/react/assets/index-r4kSa7KA.js`.

Verification before deploy:
- Suppliers JSX esbuild syntax PASS.
- Translation JSON validation PASS.
- React foundation contract PASS, including:
  - all 25 legacy IDs,
  - session/role/page permission behavior,
  - realtime supplier/purchase watchers,
  - purchase-history matching/filter semantics,
  - create/edit/delete/view_purchase permission boundaries,
  - view_purchase masking,
  - supplier CRUD/destructive confirmation behavior,
  - five-language visual labels,
  - responsive visual CSS,
  - canonical shell sync,
  - Hosting no-cache headers.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS:
  - migration coverage = 53 routes / 21 POS,
  - parity matrix PASS,
  - P0 actions PASS,
  - callables = 54 refs / 0 missing,
  - tenant-access PASS,
  - UI-layer PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.413`.
- `git diff --check` PASS.
- Authenticated local-build browser contract PASS against current Production Firestore with Firestore Write/commit/batchWrite blocked.
- Current Production supplier data = 0 suppliers.
- Desktop 1440x900:
  - Hero ~= 241px,
  - 4 Hero metrics,
  - 4 KPI cards,
  - values = 0 suppliers / 0 with history / 0 average credit / 0 purchases,
  - all 25 legacy IDs present,
  - raw translation keys = 0,
  - document horizontal overflow = 0.
- Add Supplier dialog:
  - opened for layout inspection only,
  - Desktop = 760x820,
  - 8 editable fields,
  - internal overflow contained.
- Mobile 390x844:
  - Hero ~= 334px,
  - panel = 374px,
  - supplier grid = single column,
  - Add action collapses to icon-only,
  - dialog = 374x828 and contained within viewport,
  - document horizontal overflow = 0.
- No supplier save/edit/delete action was submitted.
- Page errors = 0; request failures = 0; HTTP errors = 0.
- Firestore write attempts observed = 0.

Deploy state:
- Implementation commit `c2355430` — `feat: migrate POS suppliers to React` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.05.413` and Public `0.16.32 / 2026.10.05.128`.
- Production `/pos/suppliers` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-r4kSa7KA.js`.
- Authenticated Production visual contract PASS with Firestore Write/commit/batchWrite blocked.
- Production Desktop 1440x900:
  - Hero ~= 241px,
  - 4 Hero metrics,
  - 4 KPI cards,
  - current supplier cards = 0,
  - Add Supplier dialog = 760x820,
  - raw translation keys = 0,
  - document horizontal overflow = 0.
- Production Mobile 390x844:
  - Hero ~= 334px,
  - supplier panel = 374px,
  - supplier grid = single column,
  - Add Supplier dialog = 374x828 and contained,
  - document horizontal overflow = 0.
- Add Supplier dialog was opened only for layout inspection; no supplier save/edit/delete action was submitted.
- Page errors = 0; request failures = 0; HTTP errors = 0; Firestore write attempts observed = 0.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- Next Retail POS migration/redesign route: `/pos/customers`.
- No merge to `main`.

---
## 2026-10-05 — POS Customers canonical React migration + Customer & Loyalty Control Center

User request:
- Continue the Retail POS migration/redesign plan after Suppliers.
- Next remaining route: `/pos/customers`.
- Preserve customer/member, purchase-history, loyalty-point, permission, and tenant behavior while applying the approved colorful Control Center design.

Legacy behavior recovered/preserved:
- Customer purchase-history matching remains compatible with legacy:
  - customer ID first,
  - normalized customer name fallback.
- “With purchases” / “No purchases yet” filters are based on purchase history, not the stored `active` field.
- Search still covers customer code, ID, name, phone, and email.
- Customer purchase totals remain net of returns/refunds:
  - `max(0, sale total - sale.refundTotal)`.
- Customer codes remain `C00001`-style and are generated by the shared data layer.
- Existing point balance is preserved on customer edit.
- Customer deletion is blocked in UI when purchase history exists.
- Purchase history remains newest-first and shows net sale amount plus payment method.
- Loyalty history preserves legacy sale/return semantics:
  - normal sale: points earned / points used,
  - return: points used restored / points earned deducted,
  - balance after transaction.
- Granular permissions preserved:
  - `pos.customers.create`,
  - `pos.customers.edit`,
  - `pos.customers.delete`,
  - `pos.customers.view_history`,
  - `pos.customers.view_points`,
  - `pos.customers.view_sales`.

Data-layer additions:
- Added normalized realtime customer reader:
  - `watchPosCustomers`.
- Added loyalty-ledger readers:
  - `listPosLoyaltyLedger`,
  - `watchPosLoyaltyLedger`.
- These are read-only additions; loyalty write/transaction logic was not changed.
- Existing `listPosCustomers`, `savePosCustomer`, `deletePosCustomer`, `listPosSales`, and `watchPosSales` behavior remains in place.

Migration / implementation:
- Replaced the minimal `PosCustomersPage.jsx` draft with a complete canonical React implementation.
- Added POS session/page guard parity:
  - `getRetailPosSession()`,
  - `canUseRetailPos()`,
  - cached role rows,
  - 6s bounded role-settings wait,
  - first-allowed-route redirect,
  - 10s bounded initial data load,
  - shared PageReady overlay.
- Added realtime watchers for customers, sales, and loyalty ledger.
- Replaced native confirm/alert destructive flow with shared centered `sweetConfirm` / `sweetAlert`.
- Added typed global Toast feedback.
- Preserved all 26 legacy customer IDs:
  - `customerTotal`, `activeCustomerTotal`, `customerSalesTotal`, `customerBillTotal`,
  - `addCustomerBtn`, `customerSearch`, `customerFilter`, `customerGrid`, `customerEmpty`,
  - `customerDialog`, `customerForm`, `customerDialogTitle`, `closeCustomerDialog`,
  - `editingCustomerId`, `customerName`, `customerPhone`, `customerEmail`,
  - `customerAddress`, `customerNote`, `customerFormError`, `cancelCustomerBtn`,
  - `customerHistoryDialog`, `customerHistoryTitle`, `closeCustomerHistory`,
  - `customerHistoryList`, `toast`.
- Added React-native loyalty history dialog with stable IDs:
  - `loyaltyHistoryDialog`,
  - `loyaltyHistoryTitle`,
  - `closeLoyaltyHistory`,
  - `loyaltyHistoryList`.
- Added canonical React shell sync for `public/pos/customers/index.html`.
- Added no-cache Hosting headers for `/pos/customers` and `/pos/customers/**`.

Visual redesign:
- Added React-only `retail-customers-visual-dashboard.css`.
- Added Customer & Loyalty Control Center Hero:
  - customer total,
  - customers with purchases,
  - average points when permitted,
  - bill count when permitted.
- Added four colored KPI cards.
- Purchase-derived amount/bill surfaces remain masked/hidden without `pos.customers.view_sales`.
- Point balance and point-history controls remain hidden without `pos.customers.view_points`.
- Purchase-history action remains hidden without `pos.customers.view_history`.
- Rebuilt customer cards with:
  - member avatar/code,
  - purchase-history badge,
  - contact icons,
  - loyalty-point badge,
  - permission-aware purchase summary,
  - history/edit/delete action icons.
- Added richer search and purchase-history filters.
- Added graphical empty state.
- Rebuilt Customer editor dialog:
  - member-code preview,
  - semantic title/field icons,
  - contained scrollbar,
  - responsive two-column desktop / one-column mobile layout.
- Rebuilt purchase-history and loyalty-history dialogs as contained responsive modals.
- Added complete `pos_customers` TH / EN / MY / LO / KM catalog for the canonical React UI.

Behavior/data boundary:
- No Firestore schema/index/rule changes.
- No customer/loyalty write transaction logic was rewritten.
- Existing sale refund totals remain the source for customer net purchase values.
- Firestore rules remain final enforcement for customer delete/write roles.
- Tenant boundaries remain unchanged.
- No merge to `main`.

Release prepared:
- React `0.4.280 / 2026.10.05.414`.
- Public `0.16.32 / 2026.10.05.129`.
- Generated bundle: `/react/assets/index-uKcL3CRx.js`.

Verification before deploy:
- Customers JSX esbuild syntax PASS.
- Translation JSON validation PASS.
- React foundation contract PASS, including:
  - all 26 legacy IDs,
  - page/session/role readiness,
  - all six granular customer permissions,
  - realtime customer/sale/loyalty watchers,
  - legacy ID/name purchase-history matching,
  - active/inactive purchase-history filter semantics,
  - refund-aware net sales,
  - view_sales/view_points/view_history masking,
  - CRUD/destructive confirmation behavior,
  - five-language visual/loyalty labels,
  - responsive visual CSS,
  - canonical shell sync,
  - Hosting no-cache headers.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS:
  - migration coverage = 53 routes / 21 POS,
  - parity matrix PASS,
  - P0 actions PASS,
  - callables = 54 refs / 0 missing,
  - tenant-access PASS,
  - UI-layer PASS.
- `npm run build:react` PASS; generated build contract PASS for Build `.414`.
- `git diff --check` PASS.
- Authenticated local-build browser contract PASS against current Production Firestore with Write/commit/batchWrite blocked.
- Current Production customer data observed:
  - 5 customers,
  - 1 customer with purchase history,
  - current Hero values = 5 total / 1 with history / 39 average points / 3 bills.
- Desktop 1440x900:
  - Hero ~= 241px,
  - 4 Hero metrics,
  - 4 KPI cards,
  - 5 customer cards,
  - all 26 legacy IDs present,
  - 5 visible point-history controls,
  - 5 visible purchase-history controls for current owner account,
  - Add Customer dialog = 760x718 with 5 editable fields,
  - Purchase History dialog = 780x339 with 3 current sale rows,
  - Loyalty History dialog = 780x741 with 8 current ledger rows,
  - raw translation keys = 0,
  - document horizontal overflow = 0.
- Mobile 390x844:
  - Hero ~= 334px,
  - customer panel = 374px,
  - customer card = 348px,
  - single-column directory,
  - two-column KPI layout,
  - Add button text collapses to icon-only,
  - Customer dialog = 374x713 and contained,
  - document horizontal overflow = 0.
- Dialogs were opened only for layout/read verification; no customer save/edit/delete action was submitted.
- Page errors = 0; request failures = 0; HTTP errors = 0.
- Firestore write attempts observed = 0.

Deploy state:
- Implementation commit `9de17338` — `feat: migrate POS customers to React` — pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app` on React `0.4.280 / 2026.10.05.414` and Public `0.16.32 / 2026.10.05.129`.
- Production `/pos/customers` returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` and serves `/react/assets/index-uKcL3CRx.js`.
- Authenticated Production visual contract PASS with Firestore Write/commit/batchWrite blocked.
- Production Desktop 1440x900:
  - Hero ~= 241px,
  - 4 Hero metrics,
  - 4 KPI cards,
  - 5 customer cards,
  - Hero values = 5 total / 1 with purchases / 39 average points / 3 bills,
  - Add Customer dialog = 760x718,
  - Purchase History dialog opened with 3 current sale rows,
  - Loyalty History dialog opened with 8 current ledger rows,
  - raw translation keys = 0,
  - document horizontal overflow = 0.
- Production Mobile 390x844:
  - Hero ~= 334px,
  - customer panel = 374px,
  - customer card = 348px,
  - Customer dialog = 374x735 and contained,
  - document horizontal overflow = 0.
- Dialogs were opened only for read/layout inspection; no customer save/edit/delete action was submitted.
- Page errors = 0; request failures = 0; HTTP errors = 0; Firestore write attempts observed = 0.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- Next Retail POS migration/redesign route: `/pos/settings`.
- No merge to `main`.
---
## 2026-10-05 — Public landing color, register pricing, and shared Branding repair

User request:
- Prioritize public unauthenticated pages before continuing Retail POS Settings.
- Hide the annual promotional price block on unauthenticated Home for now, add more color, increase Register header spacing, use a red strike-through on 7,080, and replace PG fallback on Privacy / Terms / Delivery.

Work isolation:
- Primary worktree already had uncommitted /pos/settings migration work.
- This repair was developed/tested/built in isolated worktree /tmp/penguin-public-fix-20261005 from clean remote HEAD 53ae1315.
- Existing Settings files were not edited, reset, staged, or discarded.

Implementation:
- Privacy, Terms, and Delivery did not load platform-branding-runtime.js; added the shared runtime with cache identity 20261005-130.
- Home now loads public-landing-refresh.css with a richer gradient Hero, three accent-colored feature cards, colorful pricing/CTA surfaces, and safe horizontal clipping.
- #homePremiumAnnualPromo remains in the DOM for pricing compatibility but is hidden and aria-hidden.
- Register keeps existing React pricing/signup behavior; CSS adds effective Brand-to-Home action spacing and a 3px red #dc2626 line-through on .old-price-slash.
- Existing Branding geometry remains 42x42 desktop with a 36x36 contained image, preferring App Icon then Logo.

Important files:
- public/index.html
- public/assets/css/public-landing-refresh.css
- public/privacy/index.html
- public/terms/index.html
- public/delivery/index.html
- react-app/public/parity/css/register-page.css
- tools/react-foundation-contract.mjs
- release metadata and generated React shell files.

Release prepared:
- React 0.4.280 / 2026.10.05.415.
- Public 0.16.32 / 2026.10.05.130.
- Generated bundle /react/assets/index-B03opJZS.js.

Verification before deploy:
- React foundation contract PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS: migration 53 routes / 21 POS, parity matrix, P0 actions, 54 callable refs / 0 missing, tenant access, UI layer.
- npm run build:react PASS; generated build contract PASS for Build .415.
- git diff --check PASS.
- Browser contract used production origin/data with local Build .415 files and blocked Firestore Write/commit/batchWrite.
- Home desktop: public landing visible, staff dashboard hidden, annual promo display none, colorful Hero/card treatment active, horizontal overflow 0.
- Register desktop: Brand-to-Home gap 28px; old price 7,080; red line-through rgb(220, 38, 38), thickness 3px; overflow 0.
- Privacy / Terms / Delivery: configured 512x512 App Icon loads through platform-brand-image-target, 42x42 target / 36x36 contained image, overflow 0.
- Home mobile 390x844: promo hidden, Hero/card width 370px, horizontal overflow 0.
- Page errors 0; request failures 0; HTTP errors 0; Firestore writes observed 0.

Deploy state:
- Implementation commit b871c917 — fix: polish public landing and branding — pushed to origin/feature/react-firebase-port.
- Firebase Hosting target foodapp deployed successfully to https://penguin-food.web.app on React 0.4.280 / 2026.10.05.415 and Public 0.16.32 / 2026.10.05.130.
- Production Home uses /assets/css/public-landing-refresh.css?v=20261005-130 and React pages serve /react/assets/index-B03opJZS.js.
- Production browser contract PASS:
  - Home annual promo hidden, colorful Hero/feature cards active, configured 512x512 App Icon visible, desktop/mobile overflow 0.
  - Register Brand-to-Home gap = 28px; old annual price = 7,080 with red 3px line-through.
  - Privacy / Terms / Delivery each load configured 512x512 App Icon through shared Branding runtime, 42x42 target / 36x36 contained image.
  - Mobile 390x844 Home Hero/card width = 370px, promo hidden, horizontal overflow 0.
  - Page errors = 0; request failures = 0; HTTP errors = 0; Firestore writes observed = 0.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- After this interruption, continue the existing unfinished /pos/settings migration in the primary worktree.
- No merge to main.
---
## 2026-10-05 — Delivery Success Branding and Order/Delivery name-source repair

User report:
- Delivery Success header still showed PG instead of the configured platform branding image.
- The Delivery storefront Hero showed a store name from the wrong business side.

Production diagnosis (read-only):
- /s/saas-test-shop/delivery Hero rendered: สาแก่ใจพาณิชย์.
- tenantSlugs/saas-test-shop.name = ตั่วเฮียอาหารอิสาน.
- tenants/{tenantId}.name = ตั่วเฮียอาหารอิสาน.
- tenants/{tenantId}/settings/store.shopName = สาแก่ใจพาณิชย์.
- No Firestore writes were performed during diagnosis.

Root cause:
- Delivery Success did not load platform-branding-runtime.js, so its .brand-mark remained literal PG.
- Delivery Hero prioritized settings/store.shopName before the tenant Order/Delivery name. In this tenant those values differ, so the customer storefront displayed the wrong business-side name.

Implementation:
- Added publicStorefrontService.getOrderDeliveryShopName(settings) with precedence: active tenant name -> settings.orderDeliveryShopName -> settings.shopName.
- Delivery Hero now resolves its customer-facing name through getOrderDeliveryShopName().
- Delivery Success receipt now uses the same Order/Delivery name resolver, so checkout and receipt cannot disagree.
- Delivery Success now loads platform-branding-runtime.js and therefore uses App Icon -> Logo -> PG fallback behavior.
- Cache identities for Delivery runtime, Delivery Success runtime, and shared storefront service updated to 20261005-131.
- No tenant/store documents, Firestore Rules, Storage Rules, Functions, order records, payment logic, or delivery calculations changed.

Important files:
- public/assets/js/public-storefront-service.js
- public/assets/js/delivery.js
- public/assets/js/delivery-success.js
- public/delivery/index.html
- public/delivery/success/index.html
- tools/react-foundation-contract.mjs
- release metadata / generated React shells.

Release prepared:
- React 0.4.280 / 2026.10.05.416.
- Public 0.16.32 / 2026.10.05.131.
- Generated bundle /react/assets/index-CnNkzj8Q.js.

Verification before deploy:
- Local production-data overlay contract PASS at 440x956:
  - Delivery Hero = ตั่วเฮียอาหารอิสาน.
  - Delivery header configured App Icon natural source = 512x512.
  - Delivery Success receipt shop name = ตั่วเฮียอาหารอิสาน.
  - Delivery Success brand mark replaced PG with platform-brand-image-target.
  - Delivery Success App Icon natural source = 512x512; object-fit = contain.
  - Delivery and Success horizontal overflow = 0.
  - page errors = 0; request failures = 0; Firestore writes = 0.
- React foundation contract PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS: 53 routes / 21 POS, parity matrix, P0 actions, 54 callable refs / 0 missing, tenant access, UI layers.
- npm run build:react PASS; generated build contract PASS for Build .416.
- git diff --check PASS.

Deploy state:
- Implementation commit 86e63fee — fix: align delivery branding and store name — pushed to origin/feature/react-firebase-port.
- Firebase Hosting target foodapp deployed successfully to https://penguin-food.web.app on React 0.4.280 / 2026.10.05.416 and Public 0.16.32 / 2026.10.05.131.
- Production browser contract PASS at 440x956:
  - Delivery Hero = ตั่วเฮียอาหารอิสาน.
  - Delivery App Icon natural source = 512x512, object-fit contain.
  - Delivery Success receipt shop = ตั่วเฮียอาหารอิสาน.
  - Delivery Success header uses platform-brand-image-target with configured 512x512 App Icon instead of PG.
  - Delivery and Success horizontal overflow = 0.
  - Production React bundle = /react/assets/index-CnNkzj8Q.js.
  - page errors = 0; request failures = 0; HTTP errors = 0; Firestore writes = 0.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- Primary worktree /pos/settings changes remain intentionally isolated and untouched.
- No merge to main.
---
## 2026-10-05 — Kitchen/Cashier melody + spoken new-order alerts

User request:
- Kitchen and Cashier new-order alerts were not audible.
- Replace the plain alert with Waiting Queue-style melody + spoken Thai female announcement:
  melody -> "มียอดสั่งซื้อใหม่" -> Order/Delivery/Takeaway/Walk-in -> order amount in baht.
- Voice speed should be as natural as possible and use the Waiting Queue screen as the sound-pattern reference.

Diagnosis:
- Shared React CashierOrderNotifier defaulted a new browser to disabled and persisted `food_order_order_alerts_enabled_v3=0`, so many staff sessions never attempted audio playback.
- It relied on one HTMLAudioElement WAV unlock/play path; browser autoplay blocking could leave it silent.
- Cashier explicitly excluded `walkin` orders from alerts.
- Waiting Queue display already used a browser-safe AudioContext chime pattern and explicit audio arming, which was used as the reference.

Implementation:
- Added `react-app/src/components/orderAlertAudio.js` as the shared order-alert audio controller.
- New alert preference key `food_order_order_alerts_enabled_v4` defaults ON; an explicit v4 off choice remains respected.
- Kitchen and Cashier continue sharing CashierOrderNotifier.
- Audio arming now:
  - opportunistically attempts AudioContext resume on mount,
  - retries on pointer/touch/keyboard staff interaction,
  - lets the bell button explicitly arm and play a confirmation chime when needed.
- Replaced the old WAV-only alert with the Waiting Queue-style four-note melody (659.25 / 783.99 / 987.77 / 783.99 Hz).
- After the melody, Web Speech API announces one phrase per new order, sequentially so simultaneous orders do not talk over each other.
- Spoken Thai phrase format is exactly: `มียอดสั่งซื้อใหม่ {channel} {amount} บาท`.
- Channel speech mapping:
  - table / dine-in / other operational order -> ออเดอร์
  - delivery -> เดลิเวอรี่
  - takeaway -> เทคอะเวย์
  - walkin / walk-in / walking -> วอล์กอิน.
- Amount source prefers totalAmount / total / netTotal, with subtotal/items fallback.
- Thai female voice selection prioritizes Kanya / Premwadee / Narisa / other non-male Thai voices; macOS on the development machine exposes Kanya (th_TH).
- Speech uses `th-TH`, rate 0.96, pitch 1.03, volume 1 for a natural pace.
- Cashier no longer excludes Walk-in orders.
- Existing toast/title flashing and all order business logic remain unchanged.

Important files:
- react-app/src/components/CashierOrderNotifier.jsx
- react-app/src/components/orderAlertAudio.js
- tools/react-foundation-contract.mjs
- release metadata and generated React shells.

Release prepared:
- React 0.4.280 / 2026.10.05.417.
- Public 0.16.32 / 2026.10.05.132.
- Generated bundle `/react/assets/index-CfzpwOg9.js`.

Verification before deploy:
- Order alert pure contract PASS:
  - Order 120 -> `มียอดสั่งซื้อใหม่ ออเดอร์ 120 บาท`
  - Delivery 259.5 -> `มียอดสั่งซื้อใหม่ เดลิเวอรี่ 259.5 บาท`
  - Takeaway 80 -> `มียอดสั่งซื้อใหม่ เทคอะเวย์ 80 บาท`
  - Walk-in item fallback 90 -> `มียอดสั่งซื้อใหม่ วอล์กอิน 90 บาท`.
- Female voice priority contract selected Kanya over Niwat.
- Trusted-click Chromium audio contract PASS under user-gesture autoplay policy:
  - AudioContext armed = true / running,
  - Waiting Queue-style chime played = true,
  - SpeechSynthesis completed = true.
- React foundation contract PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS: 53 routes / 21 POS, parity matrix, P0 actions, 54 callable refs / 0 missing, tenant access, UI layers.
- npm run build:react PASS; generated build contract PASS for Build .417.
- git diff --check PASS.
- Authenticated local-build overlay against Production data with Firestore writes blocked PASS:
  - Cashier order alert enabled=true, armed=true, bell-fill, no overflow.
  - Kitchen order alert enabled=true, armed=true, bell-fill, no overflow.
  - page errors = 0; request failures = 0; HTTP errors = 0; Firestore writes = 0.

Deploy state:
- Implementation commit f51e0345 — feat: add spoken order alerts — pushed to origin/feature/react-firebase-port.
- Firebase Hosting target foodapp deployed successfully to https://penguin-food.web.app on React 0.4.280 / 2026.10.05.417 and Public 0.16.32 / 2026.10.05.132.
- Production authenticated browser contract PASS:
  - /cashier: enabled=true, armed=true, bell-fill, surface=cashier, horizontal overflow 0.
  - /kitchen: enabled=true, armed=true, bell-fill, surface=kitchen, horizontal overflow 0.
  - Production bundle /react/assets/index-CfzpwOg9.js contains the spoken phrase, Delivery/Takeaway/Walk-in channel labels, v4 alert preference key, and natural speech rate.
  - page errors = 0; request failures = 0; HTTP errors = 0; Firestore writes = 0.
- Deployment scope was Hosting only.
- No order, payment, stock, Firestore Rules, Storage Rules, Functions, or Firestore data changes/deploys.
- Primary worktree `/pos/settings` uncommitted work remains isolated and untouched.
- No merge to main.
---
## 2026-10-05 — Waiting Queue stale public-board repair + Verify page visual/branding polish

User report:
- Waiting Queue display still showed W005 as currently called and W004 as next even though the staff Waiting Queue manager showed 0 queues.
- Public /verify page was visually plain and still showed the PG fallback instead of configured Super Admin Branding.

Production diagnosis:
- Staff watchWaitingQueues already filters `queueDate === today`.
- Public watchPublicQueueBoard previously filtered only `active === true` and did not filter queueDate.
- Read-only Production inspection for tenant `13c9bb08-927b-4f9c-a2ef-b320ef7eed99` found stale active waitingQueueBoard projections:
  - W001 / 2026-09-03 / called
  - W001 / 2026-09-28 / called
  - W004 / 2026-09-29 / waiting
  - W005 / 2026-09-29 / called.
- That mismatch explains why staff UI showed zero current-day queues while the public display kept showing W005/W004.

Controlled Production cleanup:
- Used the existing authenticated staff session and project Firebase config.
- Did not delete queue history or touch `waitingQueues` source documents.
- Set `active=false` only on stale active projections whose `queueDate != 2026-10-05`:
  - 4 documents in `waitingQueueBoard`.
  - 4 paired documents in `waitingQueuePublic`.
- Post-cleanup public read confirmed `active=[]`, current queue empty, upcoming queue empty.

Waiting Queue code repair:
- `watchPublicQueueBoard()` now filters rows to the current local queue date.
- `WaitingQueueDisplayPage` defensively filters board rows against a live `todayKey`, so a display left open across midnight cannot keep yesterday's queue visible.
- Added `cleanupStaleWaitingQueueProjections(tenantId)` to deactivate stale active board/public projections while retaining history.
- Staff Waiting Queue manager invokes the cleanup on load; no delete path was added.

Verify page repair:
- Added `public/assets/css/verify-page.css` with a responsive green visual verification-card layout.
- Verify header now loads shared `platform-branding-runtime.js`, so configured Super Admin App Icon/Logo replaces PG fallback.
- Hero, shop identity, latest-data badge, summary metric cards, delivery detail panel, and item/round cards were redesigned.
- Verify store name now prefers resolved tenant name before `settings.orderDeliveryShopName` / `settings.shopName`, keeping the customer-facing order side consistent.
- Existing order/payment/total/delivery-fee calculations and data reads are preserved.
- User-supplied order verification page now renders tenant name `ตั่วเฮียอาหารอิสาน` instead of the generic store-settings name.

Important files:
- react-app/src/data/waitingQueueCore.js
- react-app/src/pages/WaitingQueueDisplayPage.jsx
- react-app/src/pages/WaitingQueuePage.jsx
- public/verify/index.html
- public/assets/js/verify.js
- public/assets/css/verify-page.css
- tools/react-foundation-contract.mjs
- release metadata and generated React shells.

Release prepared:
- React 0.4.280 / 2026.10.05.418.
- Public 0.16.32 / 2026.10.05.133.
- Generated bundle `/react/assets/index-Qj2lEdVl.js`.

Verification before deploy:
- Syntax checks PASS for WaitingQueueDisplayPage, WaitingQueuePage, waitingQueueCore, and verify.js.
- React foundation contract PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS: 53 routes / 21 POS, parity matrix, P0 actions, 54 callable refs / 0 missing, tenant access, UI layers.
- npm run build:react PASS; generated build contract PASS for Build .418.
- git diff --check PASS.
- Production-data local overlay contract PASS with Firestore writes blocked:
  - Waiting Queue display current hidden=true, upcoming=0, bundle index-Qj2lEdVl.js, overflow=0.
  - Verify configured Branding image natural size 512x512; object-fit contain.
  - Verify shop = ตั่วเฮียอาหารอิสาน.
  - Verify summary metrics=6, delivery panel visible, active item rows=4.
  - Desktop overflow=0; mobile 440x956 result/hero width=422px and overflow=0.
  - raw translation keys=false.
  - page errors=0; request failures=0; HTTP errors=0; browser verification writes=0.

Deploy state:
- Implementation commit 7760b777 — fix: repair waiting queue display and verify page — pushed to origin/feature/react-firebase-port.
- Firebase Hosting target foodapp deployed successfully to https://penguin-food.web.app on React 0.4.280 / 2026.10.05.418 and Public 0.16.32 / 2026.10.05.133.
- Production browser contract PASS:
  - Waiting Queue display current hidden=true, upcoming=0, active waitingQueueBoard rows=[], bundle /react/assets/index-Qj2lEdVl.js, overflow=0.
  - Verify configured Branding image natural size 512x512; object-fit contain.
  - Verify shop = ตั่วเฮียอาหารอิสาน.
  - Verify summary metrics=6, delivery panel visible, active item rows=4.
  - Verify CSS/runtime cache identities = verify-page.css?v=20261005-133, platform-branding-runtime.js?v=20261005-133, verify.js?v=20261005-133.
  - Desktop overflow=0; mobile 440x956 result/hero width=422px and overflow=0.
  - raw translation keys=false.
  - page errors=0; request failures=0; HTTP errors=0; browser verification writes=0.
- Deployment scope was Hosting only.
- No Firestore Rules, Storage Rules, Functions, or source waitingQueues documents changed/deployed.
- Controlled data repair changed only eight stale public projection documents to active=false while preserving history.
- Primary worktree `/pos/settings` uncommitted work remains isolated and untouched.
- No merge to main.
---
## 2026-10-05 — Kitchen cancel action icons

User request:
- Add icons to every visible Kitchen cancel button so the actions match Cashier.

Implementation:
- Kitchen per-item Cancel now uses `<i className="bi bi-x-circle app-icon">` followed by its translated label span.
- Kitchen Cancel entire order now uses the same `bi-x-circle app-icon` + label-span structure as Cashier.
- Existing cancel callbacks, confirmation dialogs, order/item mutation logic, permissions, and data behavior are unchanged.
- Added a React foundation regression contract to require Cashier-style icon markup on both Kitchen cancel action types.

Important files:
- react-app/src/pages/KitchenPage.jsx
- tools/react-foundation-contract.mjs
- react-app/src/config/release.js
- public/assets/js/app-info.js
- generated React entry shells/bundle.

Release prepared:
- React 0.4.280 / 2026.10.05.419.
- Public 0.16.32 / 2026.10.05.134.
- Generated bundle `/react/assets/index-6wt5v3I8.js`.

Verification before deploy:
- KitchenPage esbuild syntax check PASS.
- React foundation contract PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS: 53 routes / 21 POS, parity matrix, P0 actions, 54 callable refs / 0 missing, tenant access, UI layers.
- npm run build:react PASS; generated build contract PASS for Build .419.
- git diff --check PASS.
- Authenticated Production-data local overlay with Firestore writes blocked PASS:
  - 14 per-item Cancel buttons; all have `bi-x-circle app-icon` + label span.
  - 2 Cancel entire order buttons; both have `bi-x-circle app-icon` + label span.
  - Desktop buttons render flex with 7px icon/text gap.
  - Mobile item cancel icons render 18x18px.
  - Desktop/mobile horizontal overflow=0.
  - page errors=0; request failures=0; HTTP errors=0; Firestore writes=0.

Deploy state:
- Implementation commit f3529b9e — fix: add kitchen cancel action icons — pushed to origin/feature/react-firebase-port.
- Firebase Hosting target foodapp deployed successfully to https://penguin-food.web.app on React 0.4.280 / 2026.10.05.419 and Public 0.16.32 / 2026.10.05.134.
- Production authenticated browser contract PASS:
  - bundle /react/assets/index-6wt5v3I8.js.
  - footer Version 0.4.280 • Build 2026.10.05.419.
  - 14 per-item Cancel buttons; all have `bi-x-circle app-icon` + label span.
  - 2 Cancel entire order buttons; both have `bi-x-circle app-icon` + label span.
  - Desktop buttons render flex with 7px icon/text gap.
  - Mobile item cancel icons render 18x18px.
  - Desktop/mobile horizontal overflow=0.
  - page errors=0; request failures=0; HTTP errors=0; Firestore writes=0.
- Deployment scope was Hosting only.
- Primary worktree `/pos/settings` uncommitted work remains isolated and untouched.
- No Functions/Rules/Storage deployment and no merge to main.
---
## 2026-10-05 — Kitchen cancel icon Y-axis centering

User request:
- Center the icons on the Y axis for the Kitchen cancel-button work from the previous release.

Root cause / comparison:
- Cashier already used scoped button/icon centering: inline-flex button alignment, inline-grid app-icon alignment, and an x-circle optical `translateY(1px)` adjustment.
- Kitchen had the x-circle app-icon markup from Build .419 but did not yet apply the same scoped vertical-centering/optical CSS contract.

Implementation:
- Added scoped Kitchen styles for both `button[data-cancel-item]` and `button[data-cancel-order]`.
- Cancel buttons now force inline-flex / align-items center / justify-content center.
- Their app icons now use inline-grid / place-items center / align-self center / line-height 1 / vertical-align middle.
- Their x-circle `::before` glyph uses the same `translateY(1px)` optical correction as Cashier.
- Cancellation callbacks and business behavior remain unchanged.
- Added React foundation regression coverage for the Kitchen cancel icon centering contract.

Important files:
- react-app/public/parity/css/kitchen-item-editor.css
- tools/react-foundation-contract.mjs
- react-app/src/config/release.js
- public/assets/js/app-info.js
- generated React shell/bundle.

Release prepared:
- React 0.4.280 / 2026.10.05.420.
- Public 0.16.32 / 2026.10.05.135.
- Generated bundle `/react/assets/index-DLZUIbTn.js`.

Verification before deploy:
- KitchenPage syntax check PASS.
- React foundation contract PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS: 53 routes / 21 POS; parity matrix, P0 actions, 54 callable refs / 0 missing, tenant access, UI layers.
- npm run build:react PASS; generated build contract PASS for Build .420.
- git diff --check PASS.
- Authenticated Production-data local overlay with Firestore writes blocked PASS:
  - Desktop: 14 per-item Cancel + 2 Cancel-entire-order buttons.
  - Mobile: same 16 cancel actions.
  - Every cancel icon element has button-center delta Y = 0px.
  - Every icon has align-self=center and vertical-align=middle.
  - Every x-circle pseudo glyph resolves to transform matrix(..., y=1px), matching Cashier optical alignment.
  - Desktop/mobile horizontal overflow=0.
  - page errors=0; request failures=0; HTTP errors=0; Firestore writes=0.

Deploy state:
- Implementation commit 3372e619 — fix: center kitchen cancel icons — pushed to origin/feature/react-firebase-port.
- Firebase Hosting target foodapp deployed successfully to https://penguin-food.web.app on React 0.4.280 / 2026.10.05.420 and Public 0.16.32 / 2026.10.05.135.
- Production authenticated browser contract PASS:
  - bundle /react/assets/index-DLZUIbTn.js.
  - footer Version 0.4.280 • Build 2026.10.05.420.
  - 14 per-item Cancel + 2 Cancel-entire-order buttons.
  - Desktop center Y delta is 0px for all 16 cancel icons.
  - Mobile center Y delta is 0px for all 16 cancel icons.
  - Every x-circle pseudo glyph resolves to transform matrix(..., y=1px), matching Cashier optical alignment.
  - Desktop/mobile horizontal overflow=0.
  - page errors=0; request failures=0; HTTP errors=0; Firestore writes=0.
- Deployment scope was Hosting only.
- Primary worktree `/pos/settings` uncommitted work remains isolated and untouched.
- No Functions/Rules/Storage deployment and no merge to main.

---
## 2026-10-05 — Delivery shop name source isolation

User request:
- Customer-facing store name must come only from the Store Settings field shown in Admin `/admin` → “ข้อมูลร้านและการรับชำระ” → “ชื่อร้าน”.
- The Super Admin tenant name from `/admin/tenants` must not be used as the Delivery shop name.

Root cause:
- `publicStorefrontService.getOrderDeliveryShopName()` preferred `tenants/{tenantId}.name` before `settings/store.shopName`.
- For `saas-test-shop`, those values are different:
  - Store Settings `shopName`: `ตั่วเฮียส้มตำอาหารอีสาน`
  - Super Admin tenant `name`: `ตั่วเฮียอาหารอิสาน`
- That precedence caused the Delivery Hero and Delivery Success receipt to display the tenant-management label instead of the configured store name.

Implementation:
- `getOrderDeliveryShopName(settings)` now returns only `settings.shopName`.
- Removed the tenant-name and `orderDeliveryShopName` fallback from this customer-facing resolver.
- Delivery Hero and Delivery Success continue using the same shared resolver.
- Cache-busted Delivery runtime imports to `20261005-136`.
- Added/updated regression coverage so tenant name cannot regain precedence.
- No tenant route, permission, session, Firestore schema, order, payment, stock, delivery-fee, or Lalamove business logic changed.

Important files:
- `public/assets/js/public-storefront-service.js`
- `public/assets/js/delivery.js`
- `public/assets/js/delivery-success.js`
- `public/delivery/index.html`
- `public/delivery/success/index.html`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- generated React entry shells and `/react/assets/index-jXBq8T8o.js`

Release:
- React 0.4.280 / Build 2026.10.05.421.
- Public 0.16.32 / Build 2026.10.05.136.
- Generated bundle `/react/assets/index-jXBq8T8o.js`.

Verification:
- Direct read-only Firestore REST check confirmed `settings/store.shopName = ตั่วเฮียส้มตำอาหารอีสาน` and tenant `name = ตั่วเฮียอาหารอิสาน`.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS: 53 routes / 21 POS; parity matrix, P0 actions, 54 callable refs / 0 missing, tenant access, UI layers.
- `npm run build:react` PASS; generated build contract PASS for Build .421 and `/react/assets/index-jXBq8T8o.js`.
- `git diff --check` PASS.
- Local Hosting emulator + real Google Chrome PASS on 1440x900 and 390x844:
  - Hero = `ตั่วเฮียส้มตำอาหารอีสาน`.
  - Tenant label leak = false.
  - horizontal overflow = 0.
  - browser errors = 0.
- Production after deploy PASS on desktop and mobile with the same results.
- Production loaded `/assets/js/delivery.js?v=20261005-136`.

Deploy state:
- Implementation commit `fa457409` — `fix: source delivery shop name from store settings`.
- Generated build commit `2c510c31` — `build: finalize storefront shop name release`.
- Both pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Deployment scope was Hosting only; no Functions, Firestore Rules, Storage Rules, or data-changing production action.
- Primary worktree unfinished `/pos/settings` changes remain preserved and untouched.
- No merge to `main`.

---
## 2026-10-05 — Canonical POS Settings React migration

User request / starting point:
- User asked whether any POS route remained before `/pos/settings` and instructed work on POS to resume immediately.
- Repository review confirmed the canonical POS migration was already complete through `/pos/customers`; there was no unfinished POS route before Settings.
- The next route was therefore `/pos/settings`, followed by `/pos/backup` and `/pos/users`.
- Local HEAD and origin were both `a0075185` before resuming the preserved Settings work.
- Existing uncommitted Settings migration files were preserved exactly as required; no reset, clean, or discard was used.

Scope:
- Migrate canonical `/pos/settings` from the legacy static page to React/Firebase.
- Keep the user-approved modern/colorful POS management-screen direction while preserving existing settings behavior, tenant scope, permissions, IDs, and Firestore document paths.

Implementation:
- Canonical `/pos/settings` now uses the React shell through the shared entrypoint sync workflow.
- Added no-cache Hosting headers for `/pos/settings` and `/pos/settings/**`.
- Completed the responsive POS Settings Control Center UI:
  - Store information and store location map.
  - Five tenant-selectable POS themes.
  - VAT/tax configuration.
  - PromptPay configuration.
  - Receipt/paper/print configuration.
  - Loyalty configuration and examples.
  - Live receipt/settings preview.
  - Desktop/tablet/mobile responsive layout and sticky actions.
- Preserved the existing `AdminMap` provider/fallback behavior rather than creating another map implementation.
- Kept the Theme setting under `tenants/{tenantId}/settings/pos-theme` and retained unsaved preview behavior with `cache:false`.

Behavior repairs made while finalizing the migration:
- Fixed the Reset confirmation call to the actual shared API signature `sweetConfirm(message, options)`; the previous in-progress code passed one object as the message and could display an invalid `[object Object]` prompt.
- Reset now restores only Store/Tax/Payment/Receipt/Theme, matching the legacy Store Settings reset boundary; Loyalty is not reset by that action.
- `savePosStoreSettings()` now supports permission-scoped document writes via `options.sections`.
- Store editors write only `store`, `tax`, `payment`, `receipt`, and `pos-theme`.
- Loyalty editors write only `loyalty`.
- A user holding both permissions writes both groups.
- After a save, Settings reload the authoritative tenant settings documents before updating the form.
- Existing Firestore paths, collection/schema names, permission keys, session behavior, first-allowed-route behavior, and sale/stock/order logic remain unchanged.
- No Firestore Rules change was required or deployed for this Hosting migration.

Localization / contracts:
- Added the Control Center text and `Ask before printing` copy in TH / EN / MY / LO / KM.
- Updated React foundation contracts for the canonical React Settings cutover instead of incorrectly expecting the legacy Settings HTML after postbuild sync.
- Added regression guards for:
  - React Settings session/permission/readiness behavior.
  - Five-theme picker and temporary preview.
  - Granular Store-vs-Loyalty write boundaries.
  - Correct shared Reset confirmation dialog usage.
  - Responsive Control Center visual structure.
  - Complete five-language Settings Control Center translations.

Important files:
- `react-app/src/pages/PosSettingsPage.jsx`
- `react-app/src/data/retailPosData.js`
- `react-app/src/i18n/parity-translations.json`
- `react-app/public/parity/css/retail-settings-visual-dashboard.css`
- `public/react/parity/css/retail-settings-visual-dashboard.css`
- `firebase.json`
- `tools/sync-react-legacy-entrypoints.py`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- generated React route shells and `/react/assets/index-D4ssICFj.js`

Release:
- React 0.4.280 / Build 2026.10.05.422.
- Public 0.16.32 / Build 2026.10.05.137.
- Generated bundle: `/react/assets/index-D4ssICFj.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS:
  - React foundation PASS.
  - React migration coverage PASS: 53 routes / 21 POS.
  - React parity matrix PASS.
  - P0 action contract PASS.
  - React callable contract PASS: 54 references / 0 missing.
  - Tenant access contract PASS.
  - UI layer contract PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build .422 / `index-D4ssICFj.js`.
- `git diff --check` PASS.
- Authenticated Production-data candidate overlay using real Google Chrome with Firestore writes blocked PASS:
  - Desktop 1440x900 and mobile 440x956.
  - 4 status metrics.
  - 5 theme cards.
  - Actual store name, VAT, PromptPay, receipt mode, and loyalty data loaded.
  - Current POS drawer item = `/pos/settings`.
  - Theme preview changed the document theme without a Firestore write.
  - Reset dialog showed the correct title/message/cancel/confirm text and arrow-clockwise icon; test cancelled the dialog and did not reset data.
  - No raw `pos_settings.*` keys.
  - Horizontal overflow = 0.
  - Page errors = 0; request failures = 0; HTTP errors = 0; Firestore write attempts = 0.

Deploy state:
- Implementation/build commit: `eb1e04f7` — `feat: migrate POS settings to React`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Deployment scope was Hosting only. No Firestore Rules, Storage Rules, or Functions deployment.
- No production settings were changed during verification.

Production verification:
- `/pos/settings` loads `/react/assets/index-D4ssICFj.js`.
- Desktop 1440x900 PASS.
- Mobile 440x956 PASS.
- 4 status metrics and 5 theme cards visible.
- Store name = `ตั่วเฮียส้มตำอาหารอีสาน`.
- VAT = enabled, PromptPay = enabled, receipt mode = auto, Loyalty = enabled from the existing tenant data.
- Reset confirmation dialog renders the correct content and icon and was cancelled.
- Current POS menu item is `/pos/settings`.
- Horizontal overflow = 0.
- Raw translation keys = 0.
- Page errors = 0; request failures = 0; HTTP errors = 0; Firestore write attempts = 0.

Remaining POS migration:
- `/pos/backup`
- `/pos/users`
- Next route: `/pos/backup`.
- No merge to `main`.
---
## 2026-10-05 — POS scanner raw-key cleanup, scan-frame fix, and Returns search row

User request:
- Products, Stock Movements, and Stock Counts showed raw scanner translation keys in the camera button/Toast/dialog.
- The red scanner line extended to or beyond the green scan frame.
- Returns "ค้นหาบิลขาย" controls should use one desktop row with three columns instead of placing the search-mode select on its own row.

Root cause:
- React scanner flows in Products, Stock Movements, Stock Counts, and Purchases referenced pos_products.scanner.* but that scanner dictionary did not exist in parity-translations.json, so i18n correctly fell back to the raw key.
- The red line used left:12% / right:12% against the entire video viewport while the green guide used an independent min(76%, 360px) width, so their edges could visually collide/spill.
- Returns rendered search mode in a separate wrapper before the input/button row.
- Returns scanner still had Thai-only hard-coded camera labels/statuses instead of the shared scanner translation contract.

Implementation:
- Added complete scanner translation keys for TH / EN / MY / LO / KM: button, title, help, close, preparing, loading, scanning, found, success, unsupported, failed, and not_found.
- Returns now uses the same localized pos_products.scanner contract for camera button, dialog, statuses, success Toast, unsupported-device Toast, and camera-failure Toast.
- Reworked the red scan line to be centered and 12px narrower than the green guide frame, with a maximum width of 348px, so it remains fully inside the green border.
- Applied the scan-line fix to both React parity scanner CSS sources and the legacy runtime CSS generators that feed parity.
- Returns search mode, barcode/search input + scanner, and Search button now occupy one desktop grid row with three visible columns; <=700px stacks them into one column.
- No sale, stock, return, tenant, permission, scanner decode, or Firestore write behavior changed.

Important files:
- react-app/src/i18n/parity-translations.json
- react-app/src/pages/PosReturnsPage.jsx
- react-app/public/parity/css/retail-pos-barcode-scanner.css
- react-app/public/parity/css/retail-barcode-scan-tools.css
- react-app/public/parity/css/retail-returns-visual-dashboard.css
- public/assets/js/retail-pos-barcode-scanner.js
- public/assets/js/retail-barcode-scan-tools.js
- tools/react-foundation-contract.mjs
- release metadata and generated React assets/shells

Release candidate:
- React 0.4.280 / Build 2026.10.05.423.
- Public 0.16.32 / Build 2026.10.05.138.
- Generated bundle /react/assets/index-CFOr-I3e.js.

Verification before deploy:
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- npm run build:react PASS.
- Generated React build contract PASS for Build .423 / index-CFOr-I3e.js.
- git diff --check PASS.
- Authenticated Production-data candidate overlay using real Google Chrome with Firestore writes blocked PASS on:
  - /pos/products
  - /pos/stock-movements
  - /pos/stock-counts
  - /pos/purchases
  - /pos/returns
- All five routes showed localized Thai scanner button/title/help and localized unsupported-camera Toast; zero raw pos_products.scanner.* text.
- Scanner geometry measured green frame x=540..900 and red line x=546..894, confirming the red line is fully inset.
- Returns desktop 1440x900: three visible controls share the same Y row.
- Returns mobile 440x956: mode, input, and Search button stack vertically.
- Horizontal overflow = 0; page errors = 0; request failures = 0; HTTP errors = 0; Firestore write attempts = 0.

Deploy state:
- Implementation/build commit: `ebf41cba` — `fix: localize POS scanner feedback`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, or Functions deployment.
- No merge to `main`.

Production verification:
- Production loaded `/react/assets/index-CFOr-I3e.js` on Products, Stock Movements, Stock Counts, Purchases, and Returns.
- All five routes showed localized Thai scanner button/title/help and the localized unsupported-camera Toast; raw `pos_products.scanner.*` text = 0.
- Scanner geometry remained green frame x=540..900 and red line x=546..894, so the red line stayed fully inside the green border.
- Returns desktop 1440x900: exactly 3 visible search controls share one row.
- Returns mobile 440x956: search mode, input+scanner, and Search button stack vertically.
- Horizontal overflow = 0 on all verified routes.
- Page errors = 0; request failures = 0; HTTP errors = 0; Firestore write attempts = 0.
- After this UI repair, POS migration resumes at `/pos/backup`, then `/pos/users`.

---
## 2026-10-05 — React /pos mobile sale cart parity with Laravel

User request:
- Canonical React `/pos` on Mobile could show/select products but could not continue the sale like Laravel MASTER.

Root cause:
- `retail-pos-tailwind-responsive.css` deliberately hides `.cart-panel` for viewports below 64rem / 1024px.
- Current Laravel MASTER compensates with `public/assets/js/retail-mobile-cart-bar.js`, which mounts a bottom sale-cart bar and drawer through 1023px.
- React migrated the cart/business handlers but did not mount an equivalent mobile/tablet cart UI, so after adding a product the desktop cart remained hidden and there was no visible route to checkout, Hold Bill, or Held Bills.

Implementation:
- Added a React-native mobile/tablet cart bar + drawer to `PosPage.jsx` using the existing React cart state and sale handlers.
- Behavior follows current Laravel MASTER: bottom cart bar appears when the bill has value or held bills exist; drawer shows bill rows, quantity summary, net total; Checkout opens the existing React payment dialog; Hold Bill calls the existing hold flow; Held Bills opens the existing held-bill dialog; swipe-down, close button, backdrop, and Escape close the drawer.
- Bar/drawer operate through 1023px, with centered tablet treatment from 601–1023px; at 1024px the normal desktop cart panel remains the sale surface.
- Extracted the exact current Laravel mobile-cart CSS into React parity assets and added it to `tools/sync-react-parity-assets.py` so future Laravel parity syncs retain the behavior.
- Synced the local legacy runtime copy of `public/assets/js/retail-mobile-cart-bar.js` to current Laravel MASTER.
- Added `pos.mobile_cart.title` and `pos.mobile_cart.view_bill` in TH / EN / MY / LO / KM.
- Added regression contracts for the mobile cart structure/actions, 1023px CSS boundary, Laravel parity extraction, and five-language labels.
- No sale-completion logic, stock deduction, tax, payment math, tenant scope, permissions, or Firestore transaction behavior was changed.

Release candidate:
- React 0.4.280 / Build 2026.10.05.424.
- Public 0.16.32 / Build 2026.10.05.139.
- Generated bundle `/react/assets/index-BIOAaUA1.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run test:react-foundation` PASS after the final markup adjustment.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build .424 / `index-BIOAaUA1.js`.
- `git diff --check` PASS.
- Authenticated Production-data candidate overlay with Firestore write endpoints blocked PASS:
  - 440x956: desktop cart hidden; mobile bar hidden before adding a product; after adding a product the bar shows `ตะกร้าขาย`, item count/total, and `ดูบิล`.
  - 440x956 drawer: opens fully (settled transform = 0), shows one cart row, net total, Hold Bill, Held Bills, and enabled checkout.
  - 440x956 checkout: opens the existing `รับชำระเงิน` dialog and closes the drawer.
  - 768px: mobile/tablet bar is visible, centered at 720px wide, while desktop cart remains hidden.
  - 1024px: mobile bar is CSS-hidden and desktop cart panel is visible.
  - horizontal overflow = 0 at all verified widths.
  - page errors = 0; request failures = 0; HTTP errors = 0.
  - 2 expected customer-display Firestore write attempts occurred while products were added during candidate verification; both were intercepted/blocked, so Production data was not changed.

Deploy state:
- Implementation/build commit: `0dbedc6c` — `fix: restore POS mobile sale cart`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, or Functions deployment.
- No merge to `main`.

Production verification:
- Production loaded React Build `2026.10.05.424` and `/react/assets/index-BIOAaUA1.js`.
- 440x956: desktop cart remained hidden before sale; after adding one product, the bottom bar displayed `ตะกร้าขาย`, `1 รายการ • 19.00 บาท`, and `ดูบิล`.
- 440x956 drawer opened fully with settled transform = 0, one cart row, net total, enabled Hold Bill, Held Bills state, and enabled checkout.
- 440x956 checkout opened the existing `รับชำระเงิน` dialog and closed the mobile drawer; no sale was confirmed.
- 768px: mobile/tablet bar displayed as a centered 720px-wide control while the desktop cart remained hidden.
- 1024px: mobile bar was hidden and the desktop cart panel displayed normally.
- Horizontal overflow = 0 at all verified widths.
- Raw `pos.mobile_cart.*` keys = 0.
- Page errors = 0; request failures = 0; HTTP errors = 0.
- 4 expected customer-display Firestore write attempts occurred while products were added during Production verification; all were intercepted/blocked, so Production data was not modified.
- POS migration can resume at `/pos/backup`, then `/pos/users`.

---
## 2026-10-05 — POS camera scanner Toast de-duplication

User request:
- Canonical React `/pos` on mobile showed overlapping Toast feedback after a camera barcode scan, with success and error icons/messages appearing together.

Root cause:
- `finishScan()` always called the success Toast after `addProductByCode(code)`, even when the product lookup failed or the cart was already at the product stock limit.
- Camera decoders can also emit the same result more than once before the stream fully stops, so one physical scan could re-enter the completion path.

Implementation:
- Added `scanHandledRef` so only the first camera result is processed until the next scanner session starts.
- `addProductByCode()` now validates product existence, active sale-save state, available stock, and current cart quantity before returning success.
- Camera scan success Toast now renders only when `addProductByCode()` returns true.
- Error cases keep their existing typed error Toast and no longer receive an unconditional success Toast afterward.
- Scanner success uses the existing five-language `pos_products.scanner.success` translation key.
- Added a React foundation regression contract that requires the scanner callback guard and conditional success Toast.

Important files:
- `react-app/src/pages/PosPage.jsx`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`
- generated React assets/shells

Release candidate:
- React 0.4.280 / Build 2026.10.05.425.
- Public 0.16.32 / Build 2026.10.05.140.
- Generated bundle `/react/assets/index-BHntQqAj.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React foundation scanner regression contract PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build .425 / `index-BHntQqAj.js`.
- `git diff --check` PASS.

Deploy state:
- Implementation/build commit: `5cce7220` — `fix: dedupe POS scanner toast feedback`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Hosting scope only; no Firestore Rules, Storage Rules, or Functions change.
- No merge to `main`.

Production verification:
- `/pos/` loads `/react/assets/index-BHntQqAj.js`.
- Deployed bundle contains React Build `2026.10.05.425` and release marker `POS-SCANNER-TOAST-DEDUP`.
- Scanner contract now guarantees one processed camera result per scanner session and conditional success Toast only after a real cart add.
- No production sale, stock, Firestore, or settings write was performed during this verification.

---
## 2026-10-06 — Stock Count “รอบตรวจนับใหม่” workspace refresh

User request:
- `/pos/stock-counts` already had the new visual dashboard, but the “รอบตรวจนับใหม่” section still looked flat/legacy compared with the rest of the redesigned POS management UI.
- User asked for this workspace to look more modern and visually polished.

Change:
- Rebuilt the New Stock Count header as an emerald control-card surface instead of a plain white heading row.
- Added a translated Control Center kicker using the existing `visual.kicker` catalog.
- Added live status badges for counted products (`counted / total`) and current variance-item count using the existing derived stock-count state.
- Strengthened action hierarchy for `ใส่ยอดตามระบบทั้งหมด` and `ล้างยอดนับจริง` without changing their handlers or permissions.
- Converted the four setup fields into semantic mini cards with icons: count name → bookmark-star, count date → calendar, counted by → person-check, and note → chat/text.
- Refined field focus states, toolbar surface, spacing, shadows, and border hierarchy so the setup area visually matches the colorful Stock Count dashboard.
- Tablet <=900px stacks the workspace header/actions cleanly and uses two setup columns; mobile <=620px uses one setup column and touch-friendly controls.
- No stock-count calculation, permission, realtime watcher, scanner, confirmation, history, value masking, movement, or Firestore persistence logic changed.

Important files:
- `react-app/src/pages/PosStockCountsPage.jsx`
- `react-app/public/parity/css/retail-stock-counts-visual-dashboard.css`
- `public/react/parity/css/retail-stock-counts-visual-dashboard.css`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- generated React entry shells and `/react/assets/index-DvMCFTCI.js`

Release candidate:
- React 0.4.280 / Build 2026.10.06.426.
- Public 0.16.32 / Build 2026.10.06.141.
- Generated bundle `/react/assets/index-DvMCFTCI.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS: React foundation, migration coverage (53 routes / 21 POS), parity matrix, P0 actions, callable contract (54 references / 0 missing), tenant access, and UI layers.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build .426 / `index-DvMCFTCI.js`.
- `git diff --check` PASS.
- Isolated real-Chrome visual fixture PASS: Desktop 1440px = emerald workspace header + four setup cards; Tablet 768px = stacked header/actions + two setup columns; Mobile 390px = stacked header + one setup column; horizontal overflow = 0 at all three widths.
- Regression contract now guards the modern heading, live badges, semantic field icons, emerald gradient, and responsive workspace structure.

Deploy state:
- Implementation/build commit: `ea2d0da4` — `style: refresh POS stock count workspace`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, or Functions deployment.
- No merge to `main`.

Production verification:
- Production `/pos/stock-counts` loads `/react/assets/index-DvMCFTCI.js` and React Build `2026.10.06.426`.
- Authenticated verification used a temporary copy of the current Chrome profile; Firestore write endpoints were blocked.
- Desktop 1440x900: emerald heading, 2 live badges, 4 setup cards in one row, zero horizontal overflow.
- Tablet 768x900: heading/actions stacked, actions in 2 columns, setup cards in 2 columns, zero horizontal overflow.
- Mobile 390x844: stacked heading, 1-column setup cards, touch-friendly controls, zero horizontal overflow.
- Live store data loaded (1,997 products visible in the badge), raw translation keys = 0.
- Page errors = 0; request failures = 0; HTTP errors = 0; Firestore write attempts = 0.

---
## 2026-10-06 — Stock Count list/search/table visual polish + sticky column guide

User request:
- On `/pos/stock-counts`, the area from `ค้นหาชื่อสินค้า รหัส หรือบาร์โค้ด` downward still looked too flat after the first workspace redesign.
- User asked for a more modern/colorful list, clearer numeric differentiation, and a column-label guide pinned under the POS action bar so values remain understandable while scrolling.

Implementation:
- Rebuilt the search/filter area as a modern inventory-list control card with an accent rail, semantic list icon, translated title/description/filter label, and a live `visible / total` product badge.
- Restyled search, scanner, and filter controls with clearer focus states, depth, and semantic icon colors.
- Product rows now retain status accents at all times rather than only on hover.
- Recorded/system stock values use blue badges.
- Physical-count inputs use a violet surface/focus state and change visual state after a value is entered.
- Variance uses semantic green/red/neutral badges; variance value uses a distinct sky/orange/neutral palette.
- Product name/metadata typography and row spacing were strengthened.
- Added a dedicated desktop column-label strip for Product / Recorded Stock / Physical Count / Variance / Variance Value.
- On desktop >=1024px the label strip is `position: sticky` at `top:74px`, exactly matching the measured bottom of the sticky POS action bar, so labels remain visible while long stock lists scroll.
- The original semantic table `<thead>` remains in the DOM but is visually clipped on desktop when the sticky guide is active.
- Tablet keeps the horizontally scrollable native table header; mobile retains the card layout with `data-label` field labels.
- Added `min-width:0` to the count panel to prevent the 980px table from forcing tablet body overflow.
- Added list-title/list-description/filter-label translations for TH / EN / MY / LO / KM.
- Updated React foundation regression guards for the modern list controls, sticky guide, color-coded values, sticky offset, and five-language copy.
- No stock-count permissions, realtime watchers, barcode scanning, variance calculations, value masking, confirmation flow, adjustment movements, or Firestore persistence logic changed.

Release candidate:
- React 0.4.280 / Build 2026.10.06.427.
- Public 0.16.32 / Build 2026.10.06.142.
- Generated bundle `/react/assets/index-BjSA8h0S.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS including foundation, migration coverage (53 routes / 21 POS), parity matrix, P0 action, callable (54 / 0 missing), tenant access, and UI layer contracts.
- `npm run build:react` PASS; generated React build contract PASS for Build .427 / `index-BjSA8h0S.js`.
- `git diff --check` PASS.
- Authenticated Production-data candidate overlay with Firestore write endpoints blocked PASS:
  - Desktop 1440x900 loaded 1,997 live product rows, sticky guide display=grid, top=74px, native table head clipped to 1px, and no raw translation keys.
  - After scrolling 620px past the list header, sticky guide top remained 74px and matched the POS action-bar bottom at 74px exactly.
  - System stock badge computed blue (`rgb(239,246,255)` / `rgb(29,78,216)`), while Physical Count input computed violet (`rgb(250,249,255)` / `rgb(91,33,182)`).
  - Tablet 768x900 kept native horizontal table scrolling and body horizontal overflow=0.
  - Mobile 390x844 retained card rows, colored number treatment, one-column controls, and horizontal overflow=0.
  - Firestore write attempts = 0; page errors = 0; request failures = 0; HTTP errors = 0.

Deploy state:
- Implementation/build commit: `70a25822` — `style: modernize POS stock count list`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, or Functions deployment.
- No merge to `main`.

Production verification:
- Production `/pos/stock-counts` loads `/react/assets/index-BjSA8h0S.js` and React Build `2026.10.06.427`.
- Authenticated verification used live Production data with Firestore write endpoints blocked.
- Desktop 1440x900 loaded 1,997 product rows; the sticky column guide stayed at y=74, exactly matching the POS action-bar bottom at y=74, with all five labels visible.
- Recorded/system stock uses the blue treatment while Physical Count uses the violet treatment; variance and variance-value surfaces retain their semantic colors.
- Tablet 768x900 keeps the native horizontally scrollable table and body horizontal overflow = 0.
- Mobile 390x844 keeps card rows, colored numeric treatments, one-column controls, and horizontal overflow = 0.
- Raw translation keys = 0.
- Firestore write attempts = 0; page errors = 0; request failures = 0; HTTP errors = 0.

---
## 2026-10-06 — Stock Count sticky search/header alignment + Mobile card rebuild

User request:
- Keep the entire Stock Count list/search/header section pinned below the POS action bar while scrolling.
- Fix Desktop column labels not lining up with row values.
- Rebuild Mobile Stock Count product cards because the current label/value layout was visually disorganized.

Implementation:
- Wrapped the inventory controls and column guide in `count-list-sticky-shell` and made that whole shell sticky at `top:74px` for Desktop >=1024px.
- Search/filter controls therefore remain visible together with the column meanings while scrolling long product lists.
- Desktop table rows now use CSS Grid with exactly the same track definition as the sticky guide:
  - Product = flexible
  - Recorded Stock = 140px
  - Physical Count = 160px
  - Variance = 120px
  - Variance Value = 150px
- Added `has-value` / `no-value` table classes so permission-based value masking keeps grid alignment correct.
- Centered numeric cells and guide labels on the same tracks; header centers and data centers now match exactly.
- Rebuilt Mobile <=620px rows as 2-column metric cards with grid areas:
  - product product
  - system actual
  - variance value
- Product identity spans the full card width; each metric gets its own bordered surface, label, and value/input.
- Removed fixed desktop cell widths from Mobile so both metric columns expand evenly.
- Empty Bootstrap validation feedback is hidden on Mobile so inputs do not create stray vertical gaps.
- No stock-count permissions, calculations, scanner flow, history, confirmation logic, or Firestore writes changed.

Release candidate:
- React 0.4.280 / Build 2026.10.06.428.
- Public 0.16.32 / Build 2026.10.06.143.
- Generated bundle `/react/assets/index-eig90Z9R.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build .428 / `index-eig90Z9R.js`.
- `git diff --check` PASS.
- Authenticated candidate overlay with Firestore writes blocked PASS:
  - Desktop 1440x900: sticky shell position=sticky, top=74px.
  - Desktop header/data centers = [435, 894, 1044, 1184, 1319] for both guide and first row.
  - Desktop header/data widths = [778, 140, 160, 120, 150] for both guide and first row.
  - After scrolling, sticky shell top = 74 and POS header bottom = 74.
  - Mobile 440x956: product header spans both columns; system/actual share one row; variance/value share the second row; input fits its card; horizontal overflow = 0.
  - Firestore write attempts = 0; page errors = 0; request failures = 0; HTTP errors = 0.

Deploy state:
- Implementation/build commit: `6415a69e` — `fix: refine POS stock count sticky layout`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, or Functions deployment.
- No merge to `main`.

Production verification:
- Production `/pos/stock-counts` loads `/react/assets/index-eig90Z9R.js` and React Build `2026.10.06.428`.
- Authenticated live data loaded 1,997 stock rows with Firestore write endpoints blocked.
- Desktop 1440x900: sticky shell = `position:sticky; top:74px`; POS action-bar bottom = 74px.
- Desktop guide centers and first-row cell centers both equal `[435, 894, 1044, 1184, 1319]`.
- Desktop guide widths and first-row cell widths both equal `[778, 140, 160, 120, 150]`.
- Mobile 440x956: product identity spans both columns; Recorded Stock / Physical Count share the first metric row; Variance / Variance Value share the second; input stays within its card.
- Raw translation keys = 0; horizontal overflow = 0.
- Firestore write attempts = 0; page errors = 0; request failures = 0; HTTP errors = 0.

---
## 2026-10-06 — Cashier/Kitchen whole-order cancellation for active Lalamove delivery

User request:
- The bottom-most Delivery order could not be cancelled from either Cashier or Kitchen while a Lalamove job was active.

Root cause:
- Cashier replaced the local whole-order cancel button with a disabled `Lalamove dispatched` button whenever a provider job was active.
- Kitchen treated every active Lalamove dispatch as fully locked and hid the whole-order cancel action.
- Cancelling only the local Firestore order would be unsafe because the Lalamove driver job could remain active.

Implementation:
- Cashier now exposes whole-order cancellation while the provider state is still cancellable.
- Kitchen keeps item edit/cancel locked after dispatch, but restores whole-order cancellation while Lalamove itself can still be cancelled.
- Whole-order cancellation now cancels the Lalamove provider job first and only then marks the PENGUIN order cancelled.
- Provider terminal/non-cancellable states such as PICKED_UP and COMPLETED remain protected.
- Added cancellation source metadata for Cashier and Kitchen orchestration.
- Existing standalone `ยกเลิก Lalamove` action remains available; no order/session/permission schema was changed.

Verification:
- `npm run test:react-foundation` PASS.
- `git diff --check` PASS.
- Regression contracts now require Cashier and Kitchen to call `cancelLalamoveDispatch` before local order cancellation for an active provider job.

Deploy state:
- Not deployed yet; grouped into the next Hosting release after the remaining restaurant-side fixes.
- No Firestore Rules, Storage Rules, or Functions change required for this issue.
- No merge to `main`.

---
## 2026-10-06 — Kitchen edit-item modal semantic icons

User request:
- Add icons to the Kitchen item-edit modal controls.

Implementation:
- Added a pencil/edit icon badge to the modal title.
- Added an x-circle icon to Cancel and a floppy/save icon to Save Edit.
- Added modal-local alignment rules so title/action icons remain centered on desktop and mobile.
- Form fields, validation, edit limits, price/quantity recalculation, and Firestore behavior are unchanged.

Verification:
- `npm run test:react-foundation` PASS.
- `git diff --check` PASS.
- Regression contract now guards title, cancel, and save icon markup.

Deploy state:
- Not deployed yet; grouped into the next Hosting release after the remaining restaurant-side fixes.
- No Rules, Storage, or Functions change required.
- No merge to `main`.

---
## 2026-10-06 — Correct Lalamove COD payment lifecycle

User request:
- Delivery COD must not force Cashier to receive payment before delivery.
- Payment should be confirmed only after Lalamove has delivered to the customer and the merchant has verified the COD transfer from Lalamove.

Root cause:
- Delivery checkout stored `paymentMethod: cod` and `paymentStatus: unpaid` but never persisted `lalamoveCodEnabled` / `lalamoveCodAmount` even when the Lalamove quotation included `CASH_ON_DELIVERY`.
- Cashier therefore classified the order as a normal unpaid delivery and exposed the standard Receive Payment action before dispatch.
- Cashier also hid every COMPLETED Lalamove delivery, which would prevent a correctly unpaid COD order from remaining available for settlement confirmation.

Implementation:
- Lalamove COD checkout now requires the quotation to contain `CASH_ON_DELIVERY` and persists `lalamoveCodEnabled: true` plus the COD amount.
- Cashier identifies Lalamove COD from the delivery/payment method independently from the old marker, so legacy COD orders no longer expose normal pre-delivery payment collection.
- COD can dispatch while unpaid only when the dedicated COD marker is enabled, matching the existing server-side Lalamove dispatch guard.
- After Lalamove reaches COMPLETED, an unpaid COD order remains visible in Cashier instead of disappearing.
- Only then does Cashier expose a dedicated `Receive COD payment` action.
- The confirmation explicitly tells staff to verify that the Lalamove COD transfer has actually arrived before confirming.
- Confirmation sets `paymentStatus: paid`, closes the order as paid, and records `lalamoveCodSettlementStatus: received` plus settlement time.
- Added TH / EN / MY / LO / KM settlement-state translations.
- Existing server-side Lalamove completion behavior remains authoritative: COMPLETED marks delivery fulfillment but does not auto-mark COD as paid.

Verification:
- `npm run test:react-foundation` PASS.
- `git diff --check` PASS.
- Regression contract requires checkout COD markers, post-delivery Cashier visibility, dedicated settlement action, settlement fields, and all five locale strings.

Deploy state:
- Not deployed yet; grouped into the next Hosting release.
- No Functions change is required for the new lifecycle because the deployed function logic already supports unpaid COD dispatch and independent COD settlement.
- No merge to `main`.

---
## 2026-10-06 — Separate restaurant identity from Retail POS identity

User request:
- Restaurant channels (Table Order / Delivery / Takeaway / Walk-in) must use a restaurant name independent from the Retail POS store name.
- Retail POS settings/receipts must not overwrite or inherit the restaurant name as their canonical identity.

Root cause:
- Public registration already created separate `settings/store` (restaurant) and `settings/retailPos` (Retail POS) documents.
- Later Retail POS settings code regressed by loading/saving its identity through `settings/store`, so changing the POS shop name overwrote the restaurant name.
- The current test tenant confirms the regression: `settings/store.shopName` is `สมใจการค้า`, while the tenant/restaurant identity is `ตั่วเฮียอาหารอิสาน`, and `settings/retailPos` is missing.

Implementation:
- React POS settings now load both documents only for legacy field fallback, but the POS shop name is authoritative only from `settings/retailPos`.
- React POS settings now persist the POS profile to `settings/retailPos` and never write POS identity fields to `settings/store`.
- POS payment/receipt settings read the Retail POS identity first; a missing POS name falls back to `POS ร้านค้าปลีก` rather than copying the restaurant name.
- Legacy POS settings and legacy retail receipt helpers were updated to the same `settings/retailPos` boundary.
- Restaurant storefront service remains on `settings/store.shopName`; Admin restaurant settings continue to manage `settings/store`.
- Tax/payment/receipt/theme documents and permissions remain unchanged.

Verification:
- `npm run test:react-foundation` PASS.
- `git diff --check` PASS.
- Regression contract now guards `settings/retailPos` POS persistence and the customer storefront's independent `settings/store.shopName` source.

Deploy/data state:
- Code not deployed yet; grouped into the next Hosting release.
- After deploy, the current test tenant requires one intentional data repair: create `settings/retailPos` with the existing POS name `สมใจการค้า`, then restore `settings/store.shopName` to restaurant name `ตั่วเฮียอาหารอิสาน` without touching restaurant address/delivery settings.
- No Rules, Storage, or Functions deployment is required for the identity split.
- No merge to `main`.

---
## 2026-10-06 — Legacy Lalamove COD backfill + final restaurant-side release verification

Follow-up finding:
- Existing COD orders created before this fix can have `paymentMethod: cod` and a stored Lalamove quotation containing `CASH_ON_DELIVERY`, but no `lalamoveCodEnabled` marker.
- The current pending production test order `7fda0327-a461-4e37-be4d-50bbfa81a2f4` is exactly this shape, so server dispatch would reject it as not ready even though checkout had already verified COD support.

Implementation:
- Cashier treats an unpaid Lalamove COD order as dispatch-eligible in the UI.
- Immediately before requesting a fresh dispatch quote, a legacy COD order missing the marker is backfilled with `lalamoveCodEnabled`, COD amount, and pending settlement status.
- If the callable quote fails, the compatibility backfill is rolled back so an unsupported COD state is not left enabled.
- New orders do not need this path because Delivery checkout now persists COD markers at creation time.

Final verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS: migration coverage, parity matrix, P0 actions, 54 callable refs / 0 missing, tenant access, and UI layers.
- `npm run build:react` PASS; generated build contract PASS for React Build `2026.10.06.429` and bundle `/react/assets/index-C6VteOe4.js`.
- `git diff --check` PASS.
- Read-only production Firestore inspection confirmed the legacy pending COD order already stores a Lalamove quote with `specialRequests: [CASH_ON_DELIVERY]`.
- Candidate browser test against production Firebase with local candidate assets PASS: Cashier active Lalamove order exposes provider cancel + whole-order cancel; pre-delivery COD has no Receive Payment button; Kitchen whole-order cancel is available; edit modal icons render; POS settings no longer inherit restaurant name; Delivery still reads restaurant `settings/store`; desktop overflow/errors/request failures/HTTP errors/writes = 0.

Data repair note:
- Historical WORKLOG confirms the restaurant `settings/store.shopName` was `ตั่วเฮียส้มตำอาหารอีสาน` before the Retail POS settings regression overwrote it.
- After Hosting deploy, repair the test tenant by preserving `สมใจการค้า` as `settings/retailPos.shopName` and restoring `settings/store.shopName` to `ตั่วเฮียส้มตำอาหารอีสาน`.
- Do not change restaurant address, phone, coordinates, delivery provider, Lalamove settings, payment settings, orders, or stock.

Deploy state:
- Ready to commit/push and deploy Hosting only.
- No Functions, Firestore Rules, or Storage Rules change is required.
- No merge to `main`.

---
## 2026-10-06 — Restaurant-side fixes deployed + production identity repair

Release/deploy:
- Commit `dbd84290` — `fix: complete restaurant cashier COD and identity separation`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- React release `0.4.280` / Build `2026.10.06.429`.
- Public build `0.16.32` / Build `2026.10.06.144`.
- Production bundle `/react/assets/index-C6VteOe4.js`.
- Deployment scope was Hosting only; no Functions, Firestore Rules, or Storage Rules deployment.

Production data repair:
- Tenant `13c9bb08-927b-4f9c-a2ef-b320ef7eed99` was repaired with strict preconditions.
- Before: `settings/store.shopName = สมใจการค้า`; `settings/retailPos` did not exist.
- Created `settings/retailPos` preserving Retail POS identity `สมใจการค้า` plus existing address/phone and available POS profile fields.
- Restored restaurant `settings/store.shopName = ตั่วเฮียส้มตำอาหารอีสาน`, matching the last verified Store Settings value before the Retail POS regression.
- No restaurant address, phone, coordinates, delivery provider, Lalamove configuration, orders, stock, tax/payment documents, or other tenant data were changed by this repair.

Production browser verification:
- Cashier loaded `/react/assets/index-C6VteOe4.js`.
- Active Lalamove delivery exposes both `ยกเลิก Lalamove` and whole-order `ยกเลิกทุกรายการ` while provider cancellation is still allowed.
- Pending pre-delivery COD order remains unpaid and does not expose `รับชำระ`.
- Kitchen active Lalamove delivery exposes whole-order cancellation; normal editable order still opens the edit modal.
- Kitchen edit modal renders pencil title icon, x-circle Cancel icon, and floppy Save icon.
- Retail POS `/pos/settings` shows `สมใจการค้า`.
- Customer Delivery hero shows restaurant name `ตั่วเฮียส้มตำอาหารอีสาน` and loads `delivery.js?v=20261006-144`.
- Desktop horizontal overflow = 0 on checked pages.
- Page errors = 0; unexpected request failures = 0; HTTP errors = 0; verification writes = 0.
- Production contract PASS.

Branch state:
- Continue on `feature/react-firebase-port`.
- No merge to `main`.

---
## 2026-10-06 — Correct Take Away cancellation + restore original Lalamove cancellation logic

User correction:
- The order that could not be cancelled was the bottom-most Take Away order (`TA-144212-UUC`), not the Lalamove Delivery order.
- Restore the previously approved Lalamove cancellation behavior.

Production investigation:
- The active Take Away order is `9115a451-8130-4dc4-847a-66a17434f2f7`, queue `TA-144212-UUC`, status `pending`, payment `unpaid`, pickup `waiting`.
- The order is tenant-scoped and the current authenticated owner has the correct tenant membership.
- Laravel MASTER uses the ordinary order-status update path for Cashier cancellation and zeroes totals when Kitchen cancels an entire order.
- The React migration had routed every whole-order cancellation through the newer `cancelOperationalOrder()` audit helper instead of preserving the proven Take Away parity path.

Correction:
- Cashier Take Away cancellation now uses `updateOperationalOrder` through the existing `updateOrder()` wrapper with only `status: cancelled`, matching the Laravel status-update path.
- Kitchen Take Away cancellation now uses the normal update path and writes `status: cancelled`, `subtotalAmount: 0`, `deliveryFee: 0`, `totalAmount: 0`, and `cancelledAt`, matching Laravel MASTER behavior.
- Other non-Take-Away cancellation paths retain their existing React behavior.

Lalamove restore:
- Reverted the mistaken cross-flow orchestration added in Build .429.
- Cashier once again locks local whole-order cancellation while an active Lalamove provider order exists; the dedicated `ยกเลิก Lalamove` provider action remains separate.
- Kitchen once again treats an active Lalamove dispatch as locked and does not expose local whole-order cancellation during that state.
- Removed automatic provider cancellation from Cashier/Kitchen whole-order cancellation.
- COD payment lifecycle and COD settlement changes from Build .429 are intentionally retained.

Release candidate:
- React 0.4.280 / Build 2026.10.06.430.
- Public 0.16.32 / Build 2026.10.06.145.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.06.430` / `/react/assets/index-Cgt4ZKTo.js`.
- `git diff --check` PASS.
- Authenticated candidate browser test used the real active Take Away order but intercepted Firestore write-stream requests before persistence:
  - Cashier found `TA-144212-UUC`, enabled its whole-order cancel action, reached the Firestore write path, and produced 2 intercepted write-stream requests.
  - Kitchen found the same Take Away order, enabled its whole-order cancel action, reached the Firestore write path, and produced 2 intercepted write-stream requests.
  - No Production order was modified by this verification.
  - Active Lalamove Cashier card retained the dedicated provider-cancel action, had no local whole-order cancel, and showed the locked local-cancel control.
  - Active Lalamove Kitchen card had no local whole-order cancel.
  - Desktop horizontal overflow = 0; page errors = 0; unexpected request failures = 0; HTTP errors = 0.

Deploy state:
- Implementation commit: `f3312f6d` — `fix: restore takeaway cancellation and Lalamove lock`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Deployment scope was Hosting only; no Functions, Firestore Rules, or Storage Rules deployment.
- No merge to `main`.

Production verification:
- Production Cashier and Kitchen load `/react/assets/index-Cgt4ZKTo.js`.
- Cashier shows an enabled whole-order cancel action for `TA-144212-UUC`; confirming it reached the Firestore write stream (2 intercepted write requests) while persistence was blocked for safe verification.
- Kitchen shows an enabled whole-order cancel action for the same Take Away order; confirming it also reached the Firestore write stream (2 intercepted write requests) while persistence was blocked.
- Active Lalamove Cashier card shows the separate enabled `ยกเลิก Lalamove` action, no local whole-order cancel action, and the original disabled local-cancel lock indicator.
- Active Lalamove Kitchen card exposes no local whole-order cancellation while dispatch is active.
- A fresh read-only Production query after verification confirmed `TA-144212-UUC` remains `pending / unpaid / waiting`; the verification did not cancel or mutate the real order.
- Desktop horizontal overflow = 0; page errors = 0; unexpected request failures = 0; HTTP errors = 0.

---
## 2026-10-06 — Take Away cancellation root-cause fix: Firestore document ID was shadowed by legacy payload ID

Symptom:
- User confirmed Take Away still could not be cancelled from either Cashier or Kitchen after Build 2026.10.06.430.
- The affected Production queue is `TA-144212-UUC`.

Root cause proven on Production:
- The real Firestore document path is `tenants/13c9bb08-927b-4f9c-a2ef-b320ef7eed99/orders/CA9bK6dTmJR4SaSBzdI7`.
- That historical document also contains an embedded payload field `id = 9115a451-8130-4dc4-847a-66a17434f2f7`.
- React `operationalData.js` materialized snapshots as `{ id: item.id, ...item.data() }`, so the embedded payload `id` overwrote the actual Firestore document ID.
- Cashier/Kitchen therefore rendered the legacy payload UUID as `order.id` and attempted updates against a non-existent document path.
- A direct read/update test proved the distinction: updating embedded ID path returned `not-found`; an idempotent `status: pending` update against real document ID `CA9bK6dTmJR4SaSBzdI7` succeeded with the authenticated owner.
- Production audit found this was the only mismatched order among 36 orders in the current test tenant; menu/table IDs were unaffected.

Fix:
- Added `documentRow(snapshot)` in `react-app/src/data/operationalData.js`.
- Snapshot data is now spread first and the real Firestore `snapshot.id` is assigned last, so all operational actions use the canonical document path.
- When an embedded historical `id` differs, it is preserved as `legacyId` for diagnostics/backward compatibility instead of replacing the canonical ID.
- Applied the same materializer to realtime lists and direct get/update return values so an action cannot regress to the embedded legacy ID after a successful refresh/update.

Regression protection:
- `tools/operational-orders-contract.mjs` now requires the canonical `documentRow(snapshot)` materialization markers.
- Existing Take Away/Lalamove cancellation behavior from Build .430 is unchanged; this repair is only document identity resolution.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.06.431` / `/react/assets/index-dv8VlUFh.js`.
- `git diff --check` PASS.
- Authenticated candidate browser test with Production reads and Firestore writes intercepted before persistence PASS:
  - Cashier `TA-144212-UUC` receipt URL now contains real document ID `CA9bK6dTmJR4SaSBzdI7`, not legacy payload UUID.
  - Cashier cancel action is enabled and reaches the write stream.
  - Kitchen `data-cancel-order` now equals `CA9bK6dTmJR4SaSBzdI7`; cancel action is enabled and reaches the write stream.
  - Horizontal overflow = 0; page errors = 0; unexpected request failures = 0; HTTP errors = 0.
  - No Production cancellation was persisted during browser verification.

Release candidate:
- React `0.4.280` / Build `2026.10.06.431`.
- Public `0.16.32` / Build `2026.10.06.146`.

Deploy state:
- Implementation commit: `319752b1` — `fix: use Firestore ids for legacy takeaway orders`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Deployment scope was Hosting only; no Firestore Rules, Functions, or Storage Rules deployment.
- No merge to `main`.

Production verification:
- Production loads `/react/assets/index-dv8VlUFh.js`.
- Cashier `TA-144212-UUC` now renders receipt/action identity from real Firestore document ID `CA9bK6dTmJR4SaSBzdI7`; the legacy payload UUID no longer replaces `order.id`.
- Kitchen `data-cancel-order` for the same Take Away order is now `CA9bK6dTmJR4SaSBzdI7`.
- Both Cashier and Kitchen cancel actions are enabled and each reached the Firestore write stream during safe verification; all writes were intercepted before persistence.
- Read-only Production recheck confirmed the order remains `pending / unpaid / waiting`, proving the verification did not cancel it.
- Horizontal overflow = 0; page errors = 0; unexpected request failures = 0; HTTP errors = 0.

---
## 2026-10-06 — Compact Stock Count `รอบตรวจนับใหม่` card

User request:
- Simplify the green `รอบตรวจนับใหม่` card on `/pos/stock-counts`.
- Keep only the icon, title, guidance text `กรอกยอดนับจริง แล้วตรวจสอบผลต่างก่อนยืนยันปรับสต็อก`, and the two actions on the right.
- Remove the extra kicker/progress badges and reduce the card height to fit the remaining content.

Implementation:
- Removed `count-workspace-kicker` from the new-round card.
- Removed both `count-workspace-badges` summary chips from the card.
- Kept the clipboard icon, `new.title`, `new.description`, `fillSystemBtn`, and `clearActualBtn` unchanged functionally.
- Reduced desktop card padding from 20x22 to 14x18, removed implicit minimum height, reduced gap/radius/shadow, and reset the title top margin.
- Reduced the Mobile card padding/gap while retaining the existing responsive action layout.
- No Stock Count permissions, form fields, calculation logic, scanner, filters, stock write behavior, or Firestore schema changed.

Release candidate:
- React `0.4.280` / Build `2026.10.06.432`.
- Public `0.16.32` / Build `2026.10.06.147`.
- Generated bundle `/react/assets/index-BgcT2htk.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `.432` / `index-BgcT2htk.js`.
- `git diff --check` PASS.
- Authenticated candidate browser test using Production reads with Firestore writes blocked PASS:
  - Desktop 1440x900: card height 91px; title/description + exactly two visible actions; no kicker; no badges; actions remain on the right in the same row; horizontal overflow = 0.
  - Mobile 390x844: only title/description + two actions remain; no kicker/badges; horizontal overflow = 0.
  - Page errors = 0; request failures = 0; HTTP errors = 0; Firestore writes = 0.

Deploy state:
- Implementation commit: `74c6bb26` — `style: simplify POS stock count new-round card`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Deployment scope was Hosting only; no Functions, Firestore Rules, or Storage Rules deployment.
- No merge to `main`.

Production verification:
- Production loads `/react/assets/index-BgcT2htk.js`.
- Desktop 1440x900: `รอบตรวจนับใหม่` card height = 91px.
- The card contains only the clipboard icon, title, guidance text, and exactly two visible actions.
- `count-workspace-kicker` and `count-workspace-badges` are absent.
- Both action buttons remain on the right side in the same desktop row.
- Mobile 390x844 retains only the requested title/description/actions and has no horizontal overflow.
- Firestore writes = 0; page errors = 0; request failures = 0; HTTP errors = 0.

---
## 2026-10-06 — Stock Count top accent containment + continuous desktop row separators

User report:
- On `/pos/stock-counts`, the green→cyan→blue accent line at the top of the count workspace visibly protruded at the left/right rounded edges.
- The desktop product rows showed segmented horizontal separators under the System Stock and Actual Count columns instead of one continuous separator for the whole row.
- User also questioned the gray vertical line at the left side of uncounted rows and asked to leave it alone if intentional.

Diagnosis:
- `.count-panel::before` used `inset: 0 0 auto` with the parent intentionally `overflow: visible` so the inner sticky inventory shell continues to work. The accent therefore reached the exact outer rounded edge and could visibly protrude at the two corners.
- Desktop rows are CSS Grid rows, but the separator was previously drawn independently on every `<td>` via `border-bottom`. The separate cell borders created visible breaks at grid-column boundaries.
- The gray left stripe is intentional: `.count-table tbody tr.is-uncounted` sets the row accent to `#94a3b8`, and the first product cell renders a solid 4px `border-left`. It indicates an uncounted row, so it was intentionally retained.

Implementation:
- Inset the top accent by 1px on both left and right, reduced it to 4px high, and matched the inner top radius so it stays inside the rounded panel without adding overflow clipping.
- Kept `.count-panel { overflow: visible; }` unchanged so the existing sticky list/header behavior is not broken.
- On desktop (`min-width: 1024px`), moved the row separator to the grid `<tr>` as one `1px solid #edf2ef` line across the full row width.
- Removed desktop cell-level bottom borders so System Stock, Actual Count, Variance, and Variance Value no longer create segmented lines.
- Removed the separator from only the final row.
- Did not change the gray left row-state accent.

Release candidate:
- React `0.4.280` / Build `2026.10.06.433`.
- Public `0.16.32` / Build `2026.10.06.148`.
- Generated bundle `/react/assets/index-MufM75qE.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `.433` / `index-MufM75qE.js`.
- `git diff --check` PASS.
- Authenticated candidate browser test at desktop 1440x900 with Production reads and Firestore writes blocked PASS:
  - top accent computed `left:1px`, `right:1px`, `height:4px`, contained inside the panel.
  - row separator computed as one `1px solid` border on the row.
  - every desktop row cell computed `border-bottom: 0`.
  - uncounted left accent remains a solid 4px gray line (`rgb(148,163,184)`), confirming it is intentional rather than a dashed-border defect.
  - horizontal overflow = 0; Firestore writes = 0; page errors = 0; request failures = 0; HTTP errors = 0.

Deploy state:
- Implementation commit: `8fcf6f96` — `style: polish stock count row borders`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Deployment scope was Hosting only; no Functions, Firestore Rules, or Storage Rules deployment.
- No merge to `main`.

Production verification:
- Production loads `/react/assets/index-MufM75qE.js`.
- Top workspace accent is contained inside the rounded panel: computed `left:1px`, `right:1px`, `height:4px`.
- Desktop row separator is one `1px solid #edf2ef` border on the grid row; all five desktop cells have `border-bottom:0`.
- The gray left stripe remains a solid 4px row-state accent for uncounted items and was intentionally not changed.
- Horizontal overflow = 0; Firestore writes = 0; page errors = 0; request failures = 0; HTTP errors = 0.

---
## 2026-10-06 — Align Stock Count top accent to the green `รอบตรวจนับใหม่` card edges

User correction:
- The remaining left/right 'tips' were not the accent touching the white workspace border; they were the portions of the green→cyan→blue line extending beyond the green `รอบตรวจนับใหม่` card itself.
- Build `.433` reduced the line near the outer panel border, but that interpretation was still wrong because the white workspace has 20px inner padding.

Implementation:
- Desktop/tablet `.count-panel::before` now uses `left:20px; right:20px`, exactly matching the white workspace's 20px content padding and therefore the outer left/right edges of `.count-heading`.
- Mobile (`max-width:620px`) overrides the accent to `left:12px; right:12px`, matching the mobile workspace padding and green card edges.
- The line remains visible; only the overhanging portions outside the green card width were removed.
- Continuous desktop row separators from Build `.433` and the intentional gray uncounted-row left accent are unchanged.

Release candidate:
- React `0.4.280` / Build `2026.10.06.434`.
- Public `0.16.32` / Build `2026.10.06.149`.
- Generated bundle `/react/assets/index-B1Imaa_2.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `.434` / `index-B1Imaa_2.js`.
- `git diff --check` PASS.
- Authenticated candidate browser test with Production reads and Firestore writes blocked PASS:
  - Desktop 1440x900: white panel x=24..1416; green card x=45..1395; computed accent x=45..1395; left/right delta = 0px.
  - Mobile 390x844: white panel x=8..382; green card x=21..369; computed accent x=21..369; left/right delta = 0px.
  - Horizontal overflow = 0; Firestore writes = 0; page errors = 0; request failures = 0; HTTP errors = 0.

Deploy state:
- Implementation commit: `6c3368dc` — `style: align stock count accent to card`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Deployment scope was Hosting only; no Functions, Firestore Rules, or Storage Rules deployment.
- No merge to `main`.

Production verification:
- Production loads `/react/assets/index-B1Imaa_2.js`.
- Desktop 1440x900: green card edges x=45..1395 and accent x=45..1395; left/right delta = 0px.
- Mobile 390x844: green card edges x=21..369 and accent x=21..369; left/right delta = 0px.
- Therefore the top gradient line no longer extends beyond the green `รอบตรวจนับใหม่` card on either side.
- Horizontal overflow = 0; Firestore writes = 0; page errors = 0; request failures = 0; HTTP errors = 0.

---
## 2026-10-06 — POS Purchases responsive item editor and receiving overview refinement

User report:
- `/pos/purchases` looked unbalanced on desktop and especially cramped on mobile.
- Desktop purchase-item columns needed better proportions and the delete action showed an unwanted visible `ลบ` label below the trash icon.
- Mobile purchase rows were too narrow and disorganized: product selector, stock-before, received quantity, unit cost, total, and delete action did not read as one coherent item card.
- Mobile `ภาพรวมการรับสินค้า` hid the `ส่งออก CSV` text and the filter/summary layout needed better balance.

Implementation:
- Rebalanced the desktop purchase table column widths to Product 30%, Stock Before 11%, Received Qty 17%, Unit Cost 20%, Total 14%, Action 8%.
- Added a subtle green row accent, stronger numeric hierarchy, blue Stock Before value, and green line-total value.
- Kept the delete control accessible with `aria-label`/`title` but removed the child hidden-label span that was surfacing visually as `ลบ`; desktop delete is now a centered 38x38 icon-only control.
- Added explicit `purchase-line-qty` and `purchase-line-cost` classes for responsive layout targeting.
- Rebuilt each mobile purchase row as a 2-column card:
  - product selector spans the full row, with room reserved for the delete button;
  - Stock Before + Received Qty share the second row;
  - Unit Cost + Total share the third row;
  - delete is a compact 34x34 top-right icon;
  - stock uses a blue metric surface, received quantity a violet input surface, unit cost an orange input surface, and total a green metric surface.
- Detached the mobile table from desktop table-layout sizing and explicitly reset all desktop nth-column widths at the mobile breakpoint, preventing the narrow-field regression seen in the screenshots.
- Mobile report filters remain Date From/Date To, Month/All, then full-width CSV; restored visible `ส่งออก CSV` text next to the icon.
- Kept the 2x2 mobile receiving-summary cards and slightly tightened their height/padding.
- Desktop report filter columns were rebalanced so dates, presets, and CSV action fill the row more evenly.

Behavior boundary:
- No purchase persistence, stock update, supplier lookup, invoice/date/note logic, scanner behavior, CSV content, permission checks, view-cost masking, Firestore schema, collection names, or route/session behavior changed.

Release candidate:
- React `0.4.280` / Build `2026.10.06.435`.
- Public `0.16.32` / Build `2026.10.06.150`.
- Generated bundle `/react/assets/index-BI5lL2JN.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS, including foundation, migration coverage, parity matrix, P0 actions, 54 callable refs / 0 missing, tenant access, and UI-layer checks.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `.435` / `index-BI5lL2JN.js`.
- `git diff --check` PASS.
- Authenticated candidate browser verification used Production reads with Firestore writes blocked:
  - Desktop 1440x900: table row width 1348px; columns 404 / 148 / 229 / 270 / 189 / 108; delete 38x38 icon-only with accessible label; horizontal overflow = 0.
  - Mobile 390x844: row 348px wide; product selector area 319px; Stock/Qty/Cost/Total each 155px; delete 34x34 top-right; CSV action 328px wide with visible `ส่งออก CSV`; summary cards render 2x2; horizontal overflow = 0.
  - Firestore writes = 0; page errors = 0; unexpected request failures = 0; HTTP errors = 0.

Deploy state:
- Ready to commit/push and deploy Firebase Hosting only.
- No Functions, Firestore Rules, or Storage Rules change required.
- No merge to `main`.

Production deploy + verification:
- Implementation commit: `4147b9bd` — `style: refine POS purchases responsive layout`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Deployment scope was Hosting only; no Functions, Firestore Rules, or Storage Rules deployment.
- Production loads `/react/assets/index-BI5lL2JN.js`.
- Desktop 1440x900: row width 1348px; delete is 38x38 icon-only with accessible label; column widths 404 / 148 / 229 / 270 / 189 / 108; horizontal overflow = 0.
- Mobile 390x844: row width 348px; product area 319px; Stock/Qty/Cost/Total each 155px; delete 34x34 top-right; CSV action 328px wide with visible `ส่งออก CSV`; four summary cards remain 2x2; horizontal overflow = 0.
- Production verification had Firestore writes = 0; page errors = 0; unexpected request failures = 0; HTTP errors = 0.
- No merge to `main`.

---
## 2026-10-07 — POS Purchases ranking divider removal + mobile item-card header fix

User report:
- Remove the horizontal divider directly below the two purchase ranking cards (`ผู้จำหน่ายยอดซื้อสูงสุด` / `สินค้าที่รับเข้ามากที่สุด`).
- On Mobile, the product selector and top-right delete action still crowded/overlapped visually when multiple purchase-item cards were shown.

Implementation:
- Removed the legacy report-section bottom border and bottom margin from `.purchase-report`; the ranking cards now end cleanly without the extra line beneath them.
- Changed the Mobile product field so the label/delete controls occupy the card header area and the product `<select>` gets its own full-width row below.
- Increased the Mobile product-cell top inset to 38px with the product label positioned at the top-left and the delete icon kept at the top-right.
- Strengthened the mobile selector specificity with `.purchase-table td.purchase-line-product` so the table-cell `padding:0!important` rule cannot collapse the reserved header space.
- Preserved the existing 2-column Stock Before / Received Qty and Unit Cost / Total layout, color surfaces, scanner/add controls, and purchase behavior.

Behavior boundary:
- No purchase persistence, stock updates, supplier lookup, barcode scanner, permissions, view-cost masking, CSV behavior/content, Firestore schema, route, or session behavior changed.

Release candidate:
- React `0.4.280` / Build `2026.10.07.436`.
- Public `0.16.32` / Build `2026.10.07.151`.
- Generated bundle `/react/assets/index-CGqSVzEw.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS (foundation, migration coverage, parity matrix, P0 actions, callables, tenant access, UI layers).
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `.436` / `index-CGqSVzEw.js`.
- `git diff --check` PASS.
- Authenticated candidate browser verification with Production reads and Firestore writes blocked:
  - Mobile 390x844: row width 348px; product select width 319px; delete 34x34; product select begins 7px below the delete button bottom, so there is no overlap; horizontal overflow = 0.
  - Desktop and Mobile `.purchase-report` computed bottom border = `0px none`; bottom margin = `0px`.
  - Firestore writes = 0; page errors = 0; unexpected request failures = 0; HTTP errors = 0.

Deploy state:
- Ready to commit/push and deploy Firebase Hosting only.
- No Functions, Firestore Rules, or Storage Rules change required.
- No merge to `main`.

Production deploy + verification:
- Implementation commit: `8fe441a0` — `fix: refine POS purchases mobile cards`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production loads `/react/assets/index-CGqSVzEw.js`.
- Mobile 390x844: product select 319px wide; delete 34x34; select begins 7px below delete bottom; horizontal overflow = 0.
- Desktop/Mobile `.purchase-report` bottom border = `0px none`; bottom margin = `0px`, so the extra line under the two ranking cards is gone.
- Production verification: Firestore writes = 0; page errors = 0; unexpected request failures = 0; HTTP errors = 0.
- Deployment scope was Hosting only; no Functions, Firestore Rules, or Storage Rules deployment.
- No merge to `main`.

---
## 2026-10-07 — POS Purchases async searchable product picker + Firestore lazy loading

User request:
- Replace the very long native Product `<select>` on `/pos/purchases` with Select2-like searchable behavior and lazy loading.
- Keep the React route native to React rather than attaching jQuery Select2 to React-managed DOM.

Implementation:
- Replaced the native purchase product `<select>` with `AsyncProductPicker`, a React-native searchable combobox/listbox.
- Opening the picker loads only 30 products from Firestore ordered by product name.
- Empty-query browsing supports lazy pagination with `limit(30) + startAfter(cursor)`; scrolling near the bottom or pressing `โหลดสินค้าเพิ่ม` loads the next page.
- Search is debounced by 280 ms and queries Firestore by:
  - product-name prefix;
  - product-code prefix;
  - barcode prefix;
  then de-duplicates and displays up to 30 matches.
- Search result rows show product name, product code, barcode when present, and current stock.
- Added clear-selection, retry, loading, no-result, and load-more states.
- Product options are cached only after their lazy page/search result loads; the page no longer downloads or watches the complete product catalog.
- Initial Purchases data now requests only:
  - aggregate product count via `getCountFromServer`;
  - suppliers;
  - purchase history.
- Removed the full-catalog `listRetailProducts(tenant.id)` initial read and the full-catalog `watchRetailProducts(...)` realtime listener from `/pos/purchases`.
- Supplier and purchase-history realtime listeners remain unchanged.
- Barcode scanner now checks the small local product cache first, then performs exact Firestore product/document/barcode lookup only when needed.
- Purchase saving still uses the selected product's canonical `_documentId` and the existing `receivePosPurchase` transaction. No purchase/stock transaction logic changed.

Data helpers:
- Added `countRetailProducts(tenantId)`.
- Added `listRetailProductOptionsPage(tenantId, { pageSize, cursor, search })`.
- Added `findRetailProductByLookup(tenantId, value)`.
- Existing full-catalog helpers remain available for other POS routes that still require them.

Localization:
- Added picker search/clear/stock/no-results/retry/loading/load-more strings for TH / EN / MY / LO / KM.

Responsive UI:
- Desktop dropdown is a floating searchable panel with max 320px result viewport.
- Mobile dropdown matches the 319px product trigger width and caps results at 48vh.
- Opening the picker temporarily releases the desktop purchase-table wrapper overflow so the dropdown is not clipped.

Release candidate:
- React `0.4.280` / Build `2026.10.07.437`.
- Public `0.16.32` / Build `2026.10.07.152`.
- Generated bundle `/react/assets/index-C5GdNyYQ.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `.437` / `index-C5GdNyYQ.js`.
- `git diff --check` PASS.
- Authenticated candidate browser verification with Production reads and Firestore writes blocked PASS:
  - before opening the picker: 0 rendered product options, native `.line-product` selects = 0, catalog count still shows 1,997;
  - first open: exactly 30 product options;
  - `โหลดสินค้าเพิ่ม`: options increase to 60;
  - searching `101`: exactly 1 matching product (`101 พลัส ซอสหอยนางรม 280 ก.`);
  - searching barcode `8857123982063`: finds the same product;
  - selecting it updates trigger text and displays stock 26;
  - Mobile 390x844: dropdown x=37..356, width 319px, 30 options, horizontal overflow = 0;
  - Firestore writes = 0; page errors = 0; unexpected request failures = 0; HTTP errors = 0.

Deploy state:
- Implementation commit: `7ba29251` — `feat: add lazy product picker to POS purchases`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production loads `/react/assets/index-C5GdNyYQ.js`.
- Production browser verification repeated the candidate checks successfully:
  - initial rendered product options = 0 while catalog count remains 1,997;
  - first open = 30 options;
  - load more = 60 options;
  - search `101` = 1 correct result;
  - barcode `8857123982063` = same correct result;
  - selected product displays stock 26;
  - Mobile dropdown width = 319px with horizontal overflow = 0.
- Production verification: Firestore writes = 0; page errors = 0; unexpected request failures = 0; HTTP errors = 0.
- Added `.gitattributes` with `public/react/assets/*.js -whitespace` so `git diff --check` ignores false-positive trailing whitespace inside generated Vite runtime strings while source files remain checked normally.
- Deployment scope was Hosting only; no Firestore Rules, Indexes, Functions, Storage Rules, or schema migration.
- No merge to `main`.

---
## 2026-10-07 — POS Customers points-history dialog visual refresh

User report:
- `/pos/customers` points-history modal looked sparse and unbalanced, with the history content constrained to the left and a large unused white area on the right.
- User asked to reorganize the page/dialog based on the provided screenshot.

Root cause / layout diagnosis:
- The outer loyalty dialog allowed up to 780px, but the older `.loyalty-history-dialog` base rule still constrained the inner content to `min(620px, ...)`, producing a visibly empty right column.
- Point-history rows were plain two-column cards with little hierarchy between transaction identity, reference, point movement, and remaining balance.

Implementation:
- Expanded `.loyalty-history-dialog` to use the full available modal width.
- Added a dedicated warm loyalty header treatment while preserving the shared modal shell/backdrop.
- Added four read-only summary cards above the history list:
  - current points balance;
  - movement count;
  - total points earned/restored;
  - total points used/deducted.
- Added a section header showing recent point activity and the number of ledger entries.
- Redesigned each ledger entry with:
  - semantic sale/return icon;
  - sale/return badge;
  - transaction ID;
  - timestamp;
  - sale reference;
  - green/red point delta chips;
  - remaining-balance pill.
- Return rows receive a distinct orange visual treatment; sale rows retain the green semantic treatment.
- Mobile uses a 2x2 summary grid and compact responsive ledger cards; point deltas/balance move to their own bottom row to prevent crowding.
- Added an accessible close-button label.
- Added TH / EN / MY / LO / KM labels for the new summary/activity UI.

Behavior boundary:
- This is presentation/read-only summarization only.
- No customer CRUD, loyalty ledger writes, sale/return processing, point calculations, permissions, Firestore paths, schema, route, or session behavior changed.
- Existing `pos.customers.view_points` gating remains authoritative.

Release candidate:
- React `0.4.280` / Build `2026.10.07.438`.
- Public `0.16.32` / Build `2026.10.07.153`.
- Generated bundle `/react/assets/index-tegwEjTj.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `.438` / `index-tegwEjTj.js`.
- `git diff --check` PASS.
- Authenticated candidate browser verification with Production reads and Firestore writes blocked PASS:
  - Desktop 1440x900: modal 780px wide; inner content 778px wide; unused right-side gap = 1px; four summary cards each 179px; history rows 733px wide; no horizontal overflow.
  - Mobile 390x844: modal 374px wide; four summary cards render 2x2 at 171px each; history rows 339px wide; no horizontal/list overflow.
  - First visible ledger row renders `+3` and `คงเหลือ 143 แต้ม` correctly.
  - Firestore writes = 0; page errors = 0; unexpected request failures = 0; HTTP errors = 0.

Deploy state:
- Ready to commit/push and deploy Firebase Hosting only.
- No Firestore Rules, Indexes, Functions, Storage Rules, or schema migration required.
- No merge to `main`.
Production deploy + verification:
- Implementation commit: `45a66c44` — `style: refresh POS customer points history`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production loads `/react/assets/index-tegwEjTj.js`.
- Desktop 1440x900: modal 780px; inner content 778px; right-side unused gap = 1px; four 179px summary cards; history rows 733px; no horizontal/list overflow.
- Mobile 390x844: modal 374px; summary cards render 2x2 at 171px; history rows 339px; no horizontal/list overflow.
- Production verification confirmed the first ledger row still renders `+3` and `คงเหลือ 143 แต้ม` correctly.
- Firestore writes = 0; page errors = 0; unexpected request failures = 0; HTTP errors = 0.
- Deployment scope was Hosting only; no Firestore Rules, Indexes, Functions, Storage Rules, or schema migration.
- No merge to `main`.

---
## 2026-10-07 — POS Customers history-header spacing and delete dialog repair

User report:
- Customer points-history and purchase-history modal headers had icons too close to/clipped by the left edge and close buttons visually too close to the right edge.
- Customer delete confirmation rendered `[object Object]` instead of readable text.

Root cause:
- `.customer-history-head` inherited the shared `.dialog-head` negative horizontal margin (`0 -22px 16px`) even though the history-dialog shells have no matching 22px parent padding. This pushed both header edges outside the rounded dialog shell.
- `PosCustomersPage` passed an options object as the first argument to `sweetConfirm` / `sweetAlert`, but the shared API signature is `(message, options)`. String coercion therefore rendered `[object Object]`.
- The same incorrect SweetDialog call pattern was present in `PosSuppliersPage` delete flows.

Change:
- Reset Customer history header margin to `0`, force full-width border-box sizing, keep 18px header inset, and size the history close button to a centered 38x38 control.
- Made the history title icon non-shrinking at 42px.
- Corrected Customer delete blocked-alert, delete confirmation, and delete-error alert to use `sweetAlert(message, options)` / `sweetConfirm(message, options)`.
- Corrected the same latent Supplier delete SweetDialog argument misuse.
- Added regression assertions preventing object-first SweetDialog calls on Customers/Suppliers and guarding the Customer history header inset/close-control CSS.

Behavior boundary:
- No customer/supplier deletion rules, purchase-history restrictions, permissions, Firestore writes, schema, point logic, or routes changed.
- Delete confirmation still requires explicit confirmation; candidate browser verification blocked Firestore writes.

Release candidate:
- React `0.4.280` / Build `2026.10.07.439`.
- Public `0.16.32` / Build `2026.10.07.154`.
- Generated bundle `/react/assets/index-7_wAQOOo.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `.439` / `index-7_wAQOOo.js`.
- `git diff --check` PASS.
- Authenticated candidate verification against Production reads with Firestore writes blocked PASS:
  - Purchase-history dialog: icon inset 19px, close-button inset 19px, header aligned to shell within 1px, close control 38x38.
  - Points-history dialog: icon inset 19px, close-button inset 19px, header aligned to shell within 1px, close control 38x38.
  - Delete confirmation text = `ลบลูกค้า “คุณเอ นามสมมุติ” หรือไม่?`; `[object Object]` absent; buttons = `ลบ` / `ยกเลิก`.
  - Firestore writes = 0; page errors = 0; unexpected request failures = 0; HTTP errors = 0.

Deploy state:
- Ready to commit/push and deploy Firebase Hosting only.
- No Firestore Rules, Indexes, Functions, Storage Rules, or schema migration required.
- No merge to `main`.
Production deploy + verification:
- Implementation commit: `a2cf555b` — `fix: repair POS customer dialogs`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully.
- Production loads `/react/assets/index-7_wAQOOo.js`.
- Purchase-history header: left/right inset 19px; shell/header alignment within 1px; close control 38x38.
- Points-history header: left/right inset 19px; shell/header alignment within 1px; close control 38x38.
- Customer delete confirmation now renders `ลบลูกค้า “คุณเอ นามสมมุติ” หรือไม่?` with `ยกเลิก` / `ลบ`; `[object Object]` absent.
- Production verification: Firestore writes = 0; page errors = 0; unexpected request failures = 0; HTTP errors = 0.
- Deployment scope was Hosting only; no Firestore Rules, Indexes, Functions, Storage Rules, or schema migration.
- No merge to `main`.

---
## 2026-10-07 — POS Customers raw OK translation key repair

Symptom:
- Customer cannot-delete alert rendered the raw button label `shared.action.ok`.

Root cause:
- Customer/Supplier delete alerts referenced `shared.action.ok`, but the shared dictionary key is `shared.actions.ok`.

Change:
- Replaced all affected Customer and Supplier alert confirm labels with `t("shared.actions.ok")`.
- Added regression guards that reject the obsolete `shared.action.ok` key in both pages.
- No delete logic, permissions, history checks, Firestore paths, or schema changed.

Release candidate:
- React `0.4.280` / Build `2026.10.07.440`.
- Public `0.16.32` / Build `2026.10.07.155`.
- Generated bundle `/react/assets/index-BZSsI3TZ.js`.

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS.
- `git diff --check` PASS.
- Authenticated candidate test: cannot-delete message rendered correctly and confirm button rendered `ตกลง`; no raw translation key; Firestore writes/page errors/request failures/HTTP errors = 0.

Deploy state:
- Ready for Hosting-only deploy.
- No merge to `main`.
Production deploy + verification:
- Implementation commit: `66addfb9` — `fix: localize POS customer dialog actions`.
- Pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully.
- Production loads `/react/assets/index-BZSsI3TZ.js`.
- Cannot-delete alert message renders correctly and confirm button = `ตกลง`.
- Raw `shared.action.ok` / `shared.actions.ok` text is absent from the visible dialog.
- Production verification: Firestore writes = 0; page errors = 0.
- Hosting only; no Rules/Functions/Storage deployment and no merge to `main`.


---

## 2026-10-07 — POS Backup visual workspace refresh

User request:
- Modernize `/pos/backup` so it matches the newer colorful Retail POS management screens.
- Preserve all existing backup/export/restore behavior.

Change:
- Added a dedicated visual layer `retail-pos-backup-visual-dashboard.css`.
- Converted the existing export section into a dark emerald/teal hero surface while retaining the same `#exportBackupBtn` action and progress/stat containers.
- Refined the restore surface with a green/cyan/violet accent border, modern drag/drop area, selected-file chip, structured restore summary cards, warning confirmation treatment, and responsive action bar.
- Reworked the included-data list into semantic soft-color cards and added a compact storage reminder surface.
- Added desktop/tablet/mobile responsive treatment without changing any existing IDs or JavaScript event bindings.

Behavior boundary:
- No backup JSON schema, collection list, browser/local data export, product-image export/import, tenant validation, restore confirmation, Firebase write path, permissions, navigation, or business logic changed.
- Canonical route remains the existing legacy implementation for this visual-only phase.

Verification/deploy state:
- Source-only visual change prepared on branch `feature/react-firebase-port`.
- `docs/WORKLOG.md` updated before moving to `/pos/users`.
- Full Mac test/build/browser verification and Hosting deploy will run after both requested visual refreshes are complete.
- No merge to `main`.


---

## 2026-10-07 — POS Users and permissions visual workspace refresh

User request:
- Modernize `/pos/users` to match the newer Retail POS management screens after the Backup refresh.
- Preserve role/user/security behavior.

Change:
- Added `retail-pos-users-visual-dashboard.css` as a dedicated final visual layer.
- Turned the current-user strip into a modern dark-green/violet access banner with a shield badge.
- Refined the desktop role workspace into a sticky role rail plus a larger permission editor, with modern selected-role state, colored permission groups, clearer count badges, and polished action controls.
- Redesigned generated role cards and POS user cards with semantic icons, role/status/auth-state badges, and responsive card layouts while preserving all existing data/action attributes.
- Refined the user editor dialog with a structured icon/title header, modern field surfaces, hint treatment, and responsive footer.
- Added responsive tablet/mobile layouts for role cards, permission blocks, account cards, and the dialog.

Behavior boundary:
- Existing role create/edit/delete handlers, menu/action permission keys, group select/clear actions, POS user creation/update callable, Firebase Auth linkage, tenant filtering, active/suspended state, owner exclusion, IDs, and event selectors are unchanged.
- Only generated presentation markup was enriched; `data-role-id` and `data-user-id` contracts remain intact.
- Canonical route remains the existing legacy implementation for this visual-only phase.

Verification/deploy state:
- `docs/WORKLOG.md` updated after the second requested visual issue.
- Full Mac test/build, authenticated desktop/mobile browser verification, Build bump, commit/push sync, and Hosting-only deploy are next.
- No merge to `main`.

---
## 2026-10-07 — POS Backup / Users final responsive verification refinements

Local Mac verification after Remote Desktop Commander recovered exposed three presentation/runtime-readiness details before deploy:
- `/pos/backup` loaded all 12 summary metrics correctly, but the original 2-column mobile summary grid made the green hero 644px tall.
- `/pos/users` waited for remote access-data hydration before rendering the existing local/default roles, leaving the role/permission workspace visually blank while hydration was pending.
- The Users mobile editor had 8px internal horizontal overflow from the shared dialog footer's desktop `-22px` margin, and the generic POS icon enhancer injected a duplicate heading icon beside the authored dialog icon.

Refinement:
- Backup Firestore collection reads are now parallelized with `Promise.all`, preserving the same collection set/fallback behavior while reducing serial dashboard delay.
- Backup Mobile shows the 12 summary metrics as a compact swipeable horizontal stat strip; the hero now remains compact instead of expanding into six stat rows.
- Users renders the current session/default roles, permission blocks, and local empty-user state immediately, then re-renders after the existing Firebase hydration completes. Remote persistence/hydration behavior remains unchanged.
- Users editor hides the generated `h2 > .pos-context-icon` because the modal already has one authored semantic icon.
- Users mobile footer uses the same 14px modal inset as the mobile form, eliminating the previous 8px dialog overflow.
- Added regression guards for the mobile stat strip, parallel Backup reads, immediate Users local render, duplicate-icon suppression, and mobile footer inset.

Verification:
- `node --check` for touched legacy JS pending immediately after this log entry.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for React Build `2026.10.07.441` / `/react/assets/index-BaSuJWBm.js`.
- `git diff --check` PASS.
- Authenticated candidate browser test using Production reads with all Firestore writes blocked/avoided PASS:
  - Backup Desktop 1440x900: 12 summary cards, no horizontal overflow.
  - Backup Mobile 390x844: hero height 262px, 12 summary cards in a swipeable 66px-high strip, page overflow 0.
  - Backup summary data loaded in ~9.2s in the isolated candidate context after parallelization.
  - Users Desktop: 4 role cards and 2 permission blocks render immediately; current owner text resolves; page overflow 0.
  - Users Mobile: one-column workspace; 4 role cards + 2 permission blocks; page overflow 0.
  - User dialog Desktop/Mobile: one authored header icon only; generated icon hidden; dialog internal overflow 0.
  - Candidate browser run: blocked writes 0, page errors 0, unexpected request failures 0, HTTP errors 0.

Release state:
- React `0.4.280` / Build `2026.10.07.441`.
- Public `0.16.32` / Build `2026.10.07.156`.
- Hosting deploy still pending this final local commit/push.
- No merge to `main`.
Production deploy + verification:
- Implementation commit: `0f4b4e7a` — `style: finalize POS backup and users workspaces`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production React bundle is `/react/assets/index-BaSuJWBm.js`.
- `/pos/backup` Production verification:
  - Desktop 1440x900: 12 summary cards, hero 292px, page overflow 0.
  - Mobile 390x844: hero 262px, swipeable summary strip overflow confined inside the strip, page overflow 0.
  - Restore action remains disabled until a valid backup file/confirmation is supplied.
- `/pos/users` Production verification:
  - Desktop/Mobile render 4 role cards and 2 permission blocks immediately from the existing access model.
  - Current owner label resolves correctly.
  - Desktop/Mobile page overflow = 0.
  - User editor dialog internal overflow = 0, close control = 38px, duplicate generated title icon hidden.
- React `/pos` smoke check loads `/react/assets/index-BaSuJWBm.js` with horizontal overflow = 0.
- Production verification completed with Firestore writes blocked/avoided: blocked writes = 0, page errors = 0, unexpected request failures = 0, HTTP errors = 0.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or schema migration.
- `/pos/backup` and `/pos/users` remain legacy route implementations; this phase is a presentation/responsiveness refresh only.
- No merge to `main`.

---

## 2026-10-07 — POS Backup / Users platform favicon repair

User request:
- `/pos/backup` and `/pos/users` did not show the configured favicon in the browser tab.

Root cause:
- Both routes are still legacy static POS pages.
- Unlike React routes, neither page mounts React `PlatformBrandingRuntime`.
- The two static pages also did not load `/assets/js/platform-branding-runtime.js`, so no dynamic `rel="icon"` or `apple-touch-icon` link was created from `platformSettings/branding`.
- The existing static branding runtime already provides the required fallback order: Favicon -> App Icon -> Logo.

Change:
- Added `platform-branding-runtime.js?v=20261007-001` to both legacy pages.
- Added React foundation regression guards requiring both pages to retain the branding runtime.
- Bumped React Build to `2026.10.07.442` and Public Build to `2026.10.07.157`.
- No Backup/User business logic, permissions, IDs, Firebase writes, schema, or restore/user-management behavior changed.

Important files:
- `public/pos/backup/index.html`
- `public/pos/users/index.html`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.07.442` / `/react/assets/index-DrCSsy0G.js`.
- `git diff --check` PASS.
- Production deploy and browser verification are pending after commit/push.

Deploy state:
- Commit/push pending.
- Firebase Hosting-only deploy pending.
- No Firestore Rules, Storage Rules, Functions, or schema deployment.
- No merge to `main`.

Production deploy + verification:
- Implementation commit: `9ed0e810` — `fix: restore POS legacy favicons`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production source for both `/pos/backup/` and `/pos/users/` includes `/assets/js/platform-branding-runtime.js?v=20261007-001`.
- Read-only headless Google Chrome verification blocked Backup/User/navigation/permission/i18n business scripts and allowed only the branding path needed for this check.
- `/pos/backup/`: `#platformDynamicFavicon` resolved to the configured Firebase Storage favicon and `#platformAppleTouchIcon` resolved to the configured App Icon; page errors = 0.
- `/pos/users/`: `#platformDynamicFavicon` resolved to the same configured Firebase Storage favicon and `#platformAppleTouchIcon` resolved to the configured App Icon; page errors = 0.
- No business data-changing action was executed during favicon verification.
- Production React bundle is `/react/assets/index-DrCSsy0G.js`.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Functions, or schema migration.
- No merge to `main`.

---

## 2026-10-07 — Super Admin wallet/revenue-share request notification badges

User request:
- Add Super Admin badges so administrators are alerted whenever a tenant submits a PENGUIN/Lalamove wallet top-up request or a revenue-share slip.
- The notification must still appear when Slip2Go verifies the slip as matched and the backend auto-approves it.

Root cause:
- Existing Super Admin review UI is status-oriented.
- Both revenue-share and wallet top-up submission flows intentionally set `status: approved` immediately when Slip2Go returns a valid matched transaction.
- A pending-only notification therefore hides exactly the matched/auto-approved submissions the administrator still wants to know about.

Change:
- Added `platformAdminNotifications.js` using only existing Super Admin callables; no new Firestore client permissions or Functions are required.
- Notification semantics:
  - every still-pending request remains counted regardless of age;
  - a Slip2Go `matched` submission that is already `approved` is also counted on its submission day using the `Asia/Bangkok` date;
  - wallet and revenue-share counts are kept separate and also combined.
- `/platform` -> “จัดการร้านค้า” now shows a red aggregate badge plus wallet/revenue breakdown pills.
- `/admin/tenants` now shows an aggregate notification panel with Pending vs Slip2Go-today breakdown.
- Each affected tenant card shows actionable chips:
  - Revenue Share opens that tenant’s review list with status `all`, so Slip2Go auto-approved rows are visible.
  - Wallet opens the tenant wallet/top-up dialog, where both pending and auto-approved top-ups remain visible.
- Notification data refreshes every 60 seconds while a Super Admin page is open.
- Manual approve/reject actions refresh notification counts immediately.
- Added responsive desktop/mobile treatment and TH/EN/MY/LO/KM copy.
- Added regression guards requiring pending + same-day Slip2Go auto-approved counting and the aggregate/per-tenant badges.
- Prepared React Build `2026.10.07.443`, Public Build `2026.10.07.158`.

Important files:
- `react-app/src/data/platformAdminNotifications.js`
- `react-app/src/pages/PlatformPage.jsx`
- `react-app/src/pages/AdminTenantsPage.jsx`
- `react-app/public/parity/css/platform-control-center.css`
- `react-app/public/parity/css/tenant-admin-clarity.css`
- `react-app/src/i18n/parity-translations.json`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`

Verification:
- `node --check react-app/src/data/platformAdminNotifications.js` PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for React Build `2026.10.07.443` / `/react/assets/index-Du0JwFNz.js`.
- `git diff --check` PASS.
- Read-only candidate overlay loaded the new `index-Du0JwFNz.js` with page/request/HTTP errors = 0 and Firestore write attempts = 0.
- The available copied Chrome profile is authenticated as tenant `owner`, so `/platform` and `/admin/tenants` correctly redirected to `/`. It cannot be used as Super Admin visual acceptance and no authorization bypass was attempted.

Deploy state:
- Implementation commit/push pending.
- Firebase Hosting-only deploy pending.
- No Firestore Rules, Storage Rules, or Cloud Functions change/deploy is required.
- No merge to `main`.

Production deploy + verification:
- Implementation commit: `9119df55` — `feat: add super admin request badges`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production React bundle is `/react/assets/index-Du0JwFNz.js` for React Build `2026.10.07.443` / Public Build `2026.10.07.158`.
- Production HTTP checks: `/platform` = 200, `/admin/tenants` = 200, bundle = 200.
- The deployed `/platform` shell references `/react/assets/index-Du0JwFNz.js`.
- Downloaded Production bundle contains the required notification contracts: `Asia/Bangkok`, `platform-nav-notification-badge`, `tenant-admin-notification-panel`, and wallet notification load handling.
- The notification feature uses existing callable Functions and read paths only; no Firestore Rules, Storage Rules, Cloud Functions, or schema deployment occurred.
- The copied authenticated browser profile available to automation remains an `owner`, so protected Super Admin visual acceptance still cannot be truthfully claimed. The new Production bundle itself loaded without candidate page/request/HTTP errors before deploy, and role enforcement correctly redirected the owner away from Super Admin routes.
- No merge to `main`.

---

## 2026-10-07 — Platform Owners modern control center

User request:
- Redesign the real Super Admin `/platform/owners` page to look modern, polished, distinctive, and responsive.
- Implement directly in code; no mockup-first step.

Observed issue / root cause:
- The page still relied almost entirely on generic `tenant-admin.css` surfaces and inline card styles.
- Desktop used one full-width vertical owner card per store, leaving large unused horizontal space and weak hierarchy.
- Search/filter controls, store status, Owner identity, and action state were visually similar, so the page read like a long form/list rather than a Super Admin control center.

Change:
- Added a dedicated `platform-owners-modern.css` visual layer so the redesign does not alter `/admin/tenants`.
- Replaced the generic Hero with a branded Owner Control Center hero and four live metrics: total stores, stores with Owner, stores awaiting Owner, and suspended stores.
- Rebuilt the workspace header and Search/Status controls into a dedicated toolbar with icons and focus states.
- Replaced the full-width generic cards with a responsive owner-card system: 2 columns on desktop, 1 column on tablet/mobile, with store initial/avatar, slug, store status, Owner identity block, account state, contextual hint, and primary action.
- Added distinct visual states for assigned Owner, missing Owner, and suspended store.
- Modernized the existing Owner create/edit modal header to match the new workspace while preserving the existing form/actions.
- Removed the old owner-card inline presentation styles.
- Preserved the existing `listTenants`, `createTenantOwner`, `updateTenantOwner`, filtering, permissions, stable Tenant IDs, and modal submit behavior.
- Added TH / EN / MY / LO / KM strings for the new metrics, toolbar labels, result count, empty state, and account-help copy.
- Added React foundation guards for the dedicated CSS, desktop 2-column grid, responsive breakpoints, state accents, translation keys, and preserved create/edit actions.
- Prepared React `0.4.280` / Build `2026.10.07.444`; Public `0.16.32` / Build `2026.10.07.159`.

Important files:
- `react-app/src/pages/PlatformOwnersPage.jsx`
- `react-app/public/parity/css/platform-owners-modern.css`
- `react-app/src/i18n/parity-translations.json`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`

Verification:
- `npm run test:react-foundation` PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.07.444` / `/react/assets/index-C4KyVO-x.js`.
- `git diff --check` PASS.
- Authenticated candidate verification used a copied Microsoft Edge `super_admin` profile with Production reads and Firestore writes blocked:
  - Desktop 1440x900: 4 KPI cards, 3 real store cards, 3 Owner actions, 2-column grid (`670px 670px`), page overflow `0`.
  - Mobile 390x844: same 4 KPIs / 3 store cards, 1-column grid (`332px`), page overflow `0`.
  - Search empty-state passed.
  - Edit Owner modal opened read-only at 620px width with no horizontal overflow.
  - Raw translation keys `0`.
  - Firestore write attempts `0`.
  - Page errors `0`, unexpected request failures `0`, HTTP errors `0`.

Deploy state:
- Implementation commit/push pending.
- Firebase Hosting-only deploy pending.
- No Firestore Rules, Storage Rules, Functions, or schema change required.
- No merge to `main`.

Production deploy + verification:
- Implementation commit: `7fa44729` — `style: modernize platform owners workspace`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production React bundle is `/react/assets/index-C4KyVO-x.js`; dedicated Owners CSS is `/react/parity/css/platform-owners-modern.css?v=2026.10.07.444`.
- Production HTTP checks: `/platform/owners` = 200, bundle = 200, dedicated CSS = 200.
- Authenticated Production verification used the copied Microsoft Edge `super_admin` profile with Firestore writes blocked:
  - Desktop 1440x900: 4 KPI cards, 3 real store cards, 3 Owner actions, 2-column grid (`670px 670px`), hero 1400x300, page overflow `0`.
  - Mobile 390x844: 4 KPI cards, 3 store cards, 3 Owner actions, 1-column grid (`332px`), hero 366x394, page overflow `0`.
  - Production role remained `super_admin`; no auth bypass was used.
  - Raw translation keys `0`, Firestore write attempts `0`, page errors `0`, unexpected request failures `0`, HTTP errors `0`.
- No Firestore Rules, Storage Rules, Cloud Functions, or schema deployment occurred.
- No merge to `main`.

---

## 2026-10-07 — Super Admin Lalamove wallet slip viewer permission repair

User symptom:
- In `/admin/tenants`, opening a store PENGUIN/Lalamove Wallet worked, but clicking `ดูสลิป` on a credit top-up request did nothing.
- This affected both pending/manual-review top-ups and Slip2Go auto-approved rows.

Root cause:
- The React button and `openWalletSlip()` handler were working.
- Authenticated Production reproduction with a copied Microsoft Edge `super_admin` profile confirmed the click fired, the secondary `<dialog>` itself could open, but Firebase Storage returned `403` / `storage/unauthorized` for `tenants/{tenantId}/lalamove-wallet-topups/{topupId}/{file}`.
- Storage Rules allowed `tenantProductAdmin(tenantId)` to read wallet top-up slips, but a platform-level Super Admin is not a member/owner of each tenant.
- Revenue-share slips already explicitly allowed `super_admin`, so wallet top-up review was inconsistent.
- The catch path only set page status behind the already-open wallet dialog, so the failure looked like a silent button.

Change:
- Updated only the wallet top-up slip read rule to `hasRole(['super_admin']) || tenantProductAdmin(tenantId)`.
- Create/update/delete permissions remain tenant-scoped and unchanged.
- `openWalletSlip()` now shows a visible error toast if Storage URL resolution fails.
- Added `admin_tenants.wallet.slip_load_failed` copy for TH / EN / MY / LO / KM.
- Added React foundation regression guards for the Super Admin read rule, Storage URL resolution, visible failure toast, and translation coverage.
- Prepared React `0.4.280` / Build `2026.10.07.445`; Public `0.16.32` / Build `2026.10.07.160`.

Important files:
- `storage.rules`
- `react-app/src/pages/AdminTenantsPage.jsx`
- `react-app/src/i18n/parity-translations.json`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`

Verification before deploy:
- Production reproduction before the fix: enabled slip button click count = 1, slip dialog open = 0, Firebase Storage console error = `storage/unauthorized`; manual direct `showModal()` succeeded, proving the dialog was not the cause.
- `npm run test:react-foundation` PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.07.445` / `/react/assets/index-yK0yIoaV.js`.
- `git diff --check` PASS.

Deploy state:
- Commit/push pending.
- Storage Rules deploy required because the defect is an authorization-rule mismatch.
- Firebase Hosting deploy required for the visible error-toast UX and Build `.445`.
- No Firestore Rules, Cloud Functions, or schema change required.
- No merge to `main`.

Production deploy + verification:
- Implementation commit: `1b06a1ab` — `fix: allow super admin wallet slip review`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Storage Rules deployed successfully; `storage.rules` compiled and released.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle is `/react/assets/index-yK0yIoaV.js` for React Build `2026.10.07.445` / Public Build `2026.10.07.160`.
- Authenticated Production verification with the copied Microsoft Edge `super_admin` profile and Firestore writes blocked confirmed both real top-up rows from the reported wallet:
  - `6,000.00` credits, `manual_review` / pending: slip dialog opened and JPEG loaded with natural width `1194`.
  - `30,000.00` credits, `matched` / `Auto-approved by Slip2Go`: slip dialog opened and JPEG loaded with natural width `1194`.
- Firestore write attempts = `0`; console errors = `0`; page errors = `0`; HTTP errors = `0` during final verification.
- Storage write/delete permissions remain unchanged and tenant-scoped; only authenticated active Super Admin read access was added for wallet top-up slips.
- No Firestore Rules, Cloud Functions, or schema deployment occurred.
- No merge to `main`.

---

## 2026-10-07 — Permanent table QR ordering session resolver repair

User symptom:
- Cashier opened Table 12 and `/cashier/table-qr` showed the table under “issued QR”.
- Scanning/opening the permanent table URL `/s/saas-test-shop/order/?table=12` still showed “QR นี้ไม่สามารถใช้งานได้”, so customers could not order.

Root cause:
- Permanent QR cards generated by `/admin/qr` intentionally use stable tokenless URLs such as `?table=12`.
- Legacy `public/assets/js/table-qr-resolver.js` resolved that permanent URL by reading the current occupied table session, attaching its `orderToken`, and replacing the URL before order-page validation.
- During React migration, `PublicOrderPage.jsx` required both `table` and `token` immediately and therefore rejected permanent QR links before resolving the active table.
- The cashier open-table flow itself was correct: it set `status: occupied` and generated/stored a fresh `orderToken`.

Change:
- Restored permanent-QR session resolution directly in React `PublicOrderPage`.
- A tokenless/stale table URL now:
  - resolves the requested table from the public tenant table collection;
  - accepts it only when active, `occupied`, and carrying a current `orderToken`;
  - normalizes the URL to the current table code + token via `location.replace`;
  - then continues through the existing strict token/session validation.
- Existing token fallback still supports a moved table session when a token points to another currently occupied table.
- An available/closed table with no current session remains blocked.
- Added a React foundation regression guard that compares the React behavior to the legacy permanent-table resolver contract.
- Prepared React `0.4.280` / Build `2026.10.07.446`; Public `0.16.32` / Build `2026.10.07.161`.

Important files:
- `react-app/src/pages/PublicOrderPage.jsx`
- `react-app/src/data/publicStorefrontData.js` (existing public table lookup/session functions reused)
- `public/assets/js/table-qr-resolver.js` (legacy behavior reference only)
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`

Verification before deploy:
- Production Build `.445` reproduction confirmed `/s/saas-test-shop/order/?table=12` stayed tokenless and rendered “QR นี้ไม่สามารถใช้งานได้” / `INVALID_TABLE_SESSION`.
- `npm run test:react-foundation` PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.07.446` / `/react/assets/index-BMiO6KYp.js`.
- `git diff --check` PASS.
- Read-only candidate overlay against Production Firestore:
  - occupied Table 12 tokenless URL auto-resolved to `?table=12&...&token=<current-session-token>`;
  - Hero rendered “เมนูสำหรับโต๊ะ 12” and 10 real menu cards loaded;
  - page overflow = 0, page errors = 0, console errors = 0, HTTP errors = 0, Firestore writes = 0;
  - available Table 09 stayed blocked as invalid with no menus.

Deploy state:
- Commit/push pending.
- Firebase Hosting-only deploy pending.
- No Firestore Rules, Storage Rules, Cloud Functions, or schema change required.
- No merge to `main`.

Production deploy + verification:
- Implementation commit: `54285b79` — `fix: restore permanent table qr sessions`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production React bundle is `/react/assets/index-BMiO6KYp.js` for React Build `2026.10.07.446` / Public Build `2026.10.07.161`.
- Production verification used the exact tokenless permanent QR URL from the reported flow: `/s/saas-test-shop/order/?table=12`.
- Table 12 automatically normalized to the current session URL by appending the live `token` query parameter, rendered `เมนูสำหรับโต๊ะ 12`, and loaded 10 real menu cards.
- A real menu item was added locally to the cart; total changed to `120.00 บาท` and `ยืนยันการสั่ง` changed from disabled to enabled. The submit action itself was intentionally not clicked, so Production order data was not modified.
- Available Table 09 remained blocked as `QR นี้ไม่สามารถใช้งานได้` with 0 menus.
- Firestore write attempts = `0`; page errors = `0`; console errors = `0`; HTTP errors = `0`; horizontal overflow = `0`.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Cloud Functions, or schema deployment occurred.
- No merge to `main`.

---

## 2026-10-07 — Table Order modern storefront redesign

User feedback:
- After repairing permanent table QR ordering, the real `/s/{slug}/order` screen was functional but visually poor.
- The reported 1600px desktop screenshot showed cramped three-column menu cards inside a narrow content area: product names/prices wrapped vertically, the menu side felt compressed, the cart column consumed too much of the available workspace, and large unused page margins made the layout feel unbalanced.

Root cause / layout finding:
- React `PublicMenuCatalog` rendered `<div class="grid grid-3">` without the historical `#menuGrid` contract.
- Existing responsive CSS in `pos-refresh.css` already targeted `.delivery-pos #menuGrid` for the intended menu grid behavior, so those rules never applied to the React component.
- The shared `.container` remained capped at 1120px, which further compressed three menu columns next to the cart sidebar.
- Older card rules also retained `align-items:start` / `align-self:start`, causing the text/footer and `+` button positioning to shrink instead of using the available card width.

Change:
- Restored `id="menuGrid"` and added `public-menu-grid` on the shared React catalog grid.
- Added a page-scoped `table-order-modern.css` loaded only by `PublicOrderPage` so Delivery/POS/Admin layouts are not globally redesigned.
- Desktop storefront now uses up to 1440px, with a balanced `main menu + 370px cart` layout.
- Desktop menu cards use a modern image-led 3-column layout with 16:10 imagery, two-line product names, category pills, one-line prices, and a squared-rounded green add button aligned to the card edge.
- Tablet uses inset spacing and two menu columns; Mobile uses one compact horizontal menu card per row with a 102px image and right-aligned add button.
- Reworked category controls into pill tabs, refined the search surface, cart panel, previous-round card, pagination, and fixed checkout bar.
- Preserved table-session validation, menu data, image crop positions, category filtering, search, pagination behavior, cart math, item notes, order notes, previous rounds, and order submission logic.
- Added React foundation guards for `#menuGrid`, the page-scoped visual layer, desktop 1440px workspace, 3-column card layout, image ratio, and mobile one-column reflow.
- Prepared React `0.4.280` / Build `2026.10.07.447`; Public `0.16.32` / Build `2026.10.07.162`.

Important files:
- `react-app/src/components/PublicStorefront.jsx`
- `react-app/src/pages/PublicOrderPage.jsx`
- `react-app/public/parity/css/table-order-modern.css`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.07.447` / `/react/assets/index-DVcQAL6x.js`.
- `git diff --check` PASS.
- Read-only candidate overlay against Production Firestore for active Table 12:
  - Desktop 1600x900: container `1440px`; menu area `1044px`; cart `370px`; 3 columns around `337px`; first image `335x210`; name area `303px`; price area `245px`; add button at the right edge; overflow `0`.
  - Tablet 1024x768: container `992px` with 16px inset; menu 2 columns around `308px`; overflow `0`.
  - Mobile 390x844: single-column 370px cards; 102px image; price stays on one line; add button right-aligned; overflow `0`.
  - Adding a real menu item changed the cart total to `120.00 บาท` and enabled `ยืนยันการสั่ง`; submit was intentionally not clicked.
  - Firestore write attempts `0`; page errors `0`; console errors `0`; HTTP errors `0`.

Deploy state:
- Implementation commit/push pending.
- Firebase Hosting-only deploy pending.
- No Firestore Rules, Storage Rules, Cloud Functions, or schema change required.
- No merge to `main`.

Production deploy + verification:
- Implementation commit: `a92c0c40` — `style: redesign table order storefront`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle is `/react/assets/index-DVcQAL6x.js`; Table Order loads `/react/parity/css/table-order-modern.css?v=2026.10.07.447`.
- Production Table 12 verification:
  - Desktop 1600x900: 1440px container, 3 menu columns around 337px, one-line `120.00 บาท`, 46px add button aligned to the card edge, overflow `0`.
  - Mobile 390x844: one 370px menu card per row, one-line price, 44px right-aligned add button, overflow `0`.
  - Adding one real menu item created one local cart row and enabled `ยืนยันการสั่ง`; submit was intentionally not clicked.
- Firestore write attempts `0`; page errors `0`; console errors `0`; HTTP errors `0`.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Cloud Functions, or schema deployment occurred.
- No merge to `main`.

---

## 2026-10-07 — Restore original Table Order design with two menu items per row

User clarification:
- The Build `.447` visual redesign was not desired.
- The intended UI is the previous compact Table Order design, with the specific correction that Desktop should show **2 menu items per row**, not 3, because 3 cards compressed product content too much.

Change:
- Removed the page-scoped `table-order-modern.css` redesign from `PublicOrderPage` and deleted its source/generated CSS files.
- Restored the previous compact horizontal menu-card presentation from the existing shared Order/Delivery CSS.
- Kept `id="menuGrid"` on the React `PublicMenuCatalog`; this is the missing DOM contract required by the existing `pos-refresh.css` rule `.delivery-pos #menuGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }`.
- Removed the extra redesign-only `public-menu-grid` class so the shared catalog remains as close as possible to the prior markup.
- Updated the React foundation guard to require the original compact card rules plus exactly two desktop menu columns, and to prevent `table-order-modern.css` from being loaded again.
- Preserved the permanent table QR session resolver from Build `.446`, including tokenless QR resolution, strict occupied-session validation, cart behavior, filtering, search, pagination, notes, previous rounds, and order submission.
- Prepared React `0.4.280` / Build `2026.10.07.448`; Public `0.16.32` / Build `2026.10.07.163`.

Important files:
- `react-app/src/components/PublicStorefront.jsx`
- `react-app/src/pages/PublicOrderPage.jsx`
- `react-app/public/parity/css/table-order-modern.css` (removed)
- `public/react/parity/css/table-order-modern.css` (removed)
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`

Verification before deploy:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.07.448` / `/react/assets/index-rJHzZwPo.js`.
- `git diff --check` PASS.
- Read-only candidate overlay against Production Table 12:
  - Desktop 1600x900: exactly 2 columns (`307px 307px`), compact card `307x112`, image `88x88`, one-line `120.00 บาท`, overflow `0`.
  - Tablet 1024x768: exactly 2 columns (`269px 269px`), compact card `269x112`, overflow `0`.
  - Mobile 390x844: 1 column (`366px`), compact card `366x106`, image `82x82`, overflow `0`.
  - `table-order-modern.css` is not loaded.
  - Adding one real menu item locally enabled `ยืนยันการสั่ง`; submit was intentionally not clicked.
  - Firestore write attempts `0`; page errors `0`; console errors `0`; HTTP errors `0`.

Deploy state:
- Implementation commit/push pending.
- Firebase Hosting-only deploy pending.
- No Firestore Rules, Storage Rules, Cloud Functions, or schema change required.
- No merge to `main`.

Production deploy + verification:
- Implementation commit: `2c15c8b8` — `fix: restore two-column table order cards`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production React bundle is `/react/assets/index-rJHzZwPo.js` for React Build `2026.10.07.448` / Public Build `2026.10.07.163`.
- Production Table 12 verification:
  - Desktop 1600x900: exactly 2 columns (`307px 307px`), compact `307x112` cards, 88x88 images, one-line `120.00 บาท`, overflow `0`.
  - Mobile 390x844: exactly 1 column (`366px`), compact `366x106` card, 82x82 image, one-line price, overflow `0`.
  - `table-order-modern.css` is not loaded in Production.
  - Adding one real menu item locally created one cart row and enabled `ยืนยันการสั่ง`; submit was intentionally not clicked.
- Firestore write attempts `0`; page errors `0`; console errors `0`; HTTP errors `0`.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Cloud Functions, or schema deployment occurred.
- No merge to `main`.

---

## 2026-10-07 — Restore mobile Table Order category scroll-spy

User symptom:
- On Mobile Table Order, while browsing `ทั้งหมด`, scrolling down through products did not change the highlighted category tab.
- The category bar stayed on `ทั้งหมด` even when the visible products belonged to later categories.

Root cause:
- The legacy Table Order implementation had a mobile category scroll-spy (`customer.js` / `table-order-category-scrollspy.js`) that tracked the visible menu card and updated the category tab without changing the actual `activeCategory` filter.
- React `PublicMenuCatalog` only retained tab click filtering; it had no scroll-based highlighted-category state and did not expose the category DOM markers used by the legacy scroll-spy.

Change:
- Added a separate `highlightedCategory` state to `PublicMenuCatalog` so scroll highlighting is independent from `activeCategory` filtering.
- Scroll-spy runs only for React Table Order on mobile/tablet (`<=899px`) while the real filter is `ทั้งหมด`.
- Each category button now exposes `data-category`; each menu card exposes `data-menu-category`.
- On window scroll, the visible card nearest the sticky filter boundary determines the highlighted category.
- Near page bottom, the final menu category is selected.
- The category strip automatically scrolls horizontally to center the highlighted tab.
- Clicking a category still performs the existing real filter; while a specific category is selected, scroll-spy is disabled.
- Clicking `ทั้งหมด` restores the full list and re-enables scroll-spy after user scrolling.
- Desktop behavior and the existing two-menu-per-row layout remain unchanged.
- Added regression guards against the legacy scroll-spy contract.
- Prepared React `0.4.280` / Build `2026.10.07.449`; Public `0.16.32` / Build `2026.10.07.164`.

Important files:
- `react-app/src/components/PublicStorefront.jsx`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`

Verification before deploy:
- `npm run test:react-foundation` PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.07.449` / `/react/assets/index-Dx-C57cU.js`.
- `git diff --check` PASS.
- Read-only candidate overlay against Production Table 12 at 440x956:
  - initial active tab = `ทั้งหมด`, 37 visible menu cards;
  - scrolling to the `แกง` product region changed active tab to `แกง` and category strip `scrollLeft` to 58 while all 37 cards remained rendered;
  - clicking `แกง` filtered to 6 `แกง` cards;
  - clicking `ทั้งหมด` restored 37 cards;
  - Desktop 1600px remained exactly 2 columns (`307px 307px`).
  - Firestore write attempts `0`; page errors `0`; console errors `0`; HTTP errors `0`; overflow `0`.

Deploy state:
- Implementation commit/push pending.
- Firebase Hosting-only deploy pending.
- No Firestore Rules, Storage Rules, Cloud Functions, or schema change required.
- No merge to `main`.

Production deploy + verification:
- Implementation commit: `e987f612` — `fix: restore mobile category scrollspy`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle is `/react/assets/index-Dx-C57cU.js` for React Build `2026.10.07.449` / Public Build `2026.10.07.164`.
- Production Table 12 verification at 440x956 using the active token from the user-reported URL:
  - initial active category = `ทั้งหมด`, 37 cards rendered;
  - scrolling to the `แกง` region changed active tab to `แกง` and horizontally moved the category strip (`scrollLeft = 58`) while all 37 cards remained rendered;
  - Desktop 1600px remained exactly two columns (`307px 307px`) with active category `ทั้งหมด`.
- Firestore write attempts `0`; page errors `0`; console errors `0`; HTTP errors `0`; horizontal overflow `0`.
- Deployment scope was Hosting only; no Firestore Rules, Storage Rules, Cloud Functions, or schema deployment occurred.
- No merge to `main`.

---

## 2026-10-07 — Natural Thai spoken order-alert service labels

User request:
- Change only the spoken/TTS wording used for new-order alerts so it sounds natural and uses the agreed Thai service wording.
- Keep visible UI labels and order-channel business logic unchanged.
- Required spoken service labels:
  - Delivery -> `จัดส่งเดลิเวอรี่`
  - Walk-in -> `สั่งที่หน้าร้าน`
  - Takeaway -> `สั่งกลับบ้าน`
  - Table/Order -> `สั่งที่โต๊ะ`, without speaking any table number.

Root cause / current behavior:
- `react-app/src/components/orderAlertAudio.js` mapped order channels to transliterated labels: `เดลิเวอรี่`, `เทคอะเวย์`, `วอล์กอิน`, and fallback `ออเดอร์`.
- The surrounding sentence was `มียอดสั่งซื้อใหม่ ...`, which was understandable but less natural than the requested Thai phrasing.
- TTS itself already used Thai female voice selection, `th-TH`, rate `0.96`, pitch `1.03`, and the existing four-note chime; those audio characteristics did not need changing.

Change:
- `orderAlertChannelLabel()` now speaks only the agreed service wording:
  - `delivery` -> `จัดส่งเดลิเวอรี่`
  - `takeaway` / `take_away` -> `สั่งกลับบ้าน`
  - `walkin` / `walk-in` / `walking` -> `สั่งที่หน้าร้าน`
  - table/order and all remaining dine-in-compatible fallback types -> `สั่งที่โต๊ะ`.
- Changed the complete sentence to `มีรายการสั่งซื้อใหม่ {service} ยอด {amount} บาท` for more natural Thai cadence.
- Table announcements do not reference `tableCode` or `tableName`, so no table number can be spoken.
- Kept amount calculation, chime, Thai female voice preference, speech rate/pitch/volume, alert queueing, default-on behavior, and visible Cashier/Kitchen UI unchanged.
- Updated the React foundation regression guard to require all four Thai service labels, reject the previous transliterated labels, and reject table-code/table-name dependencies in the speech module.
- Prepared React `0.4.280` / Build `2026.10.07.450`; Public `0.16.32` / Build `2026.10.07.165`.

Important files:
- `react-app/src/components/orderAlertAudio.js`
- `tools/react-foundation-contract.mjs`
- `react-app/src/config/release.js`
- `public/assets/js/app-info.js`
- `README.md`

Verification before deploy:
- `npm run test:react-foundation` PASS.
- Direct helper verification PASS:
  - delivery 120 -> `มีรายการสั่งซื้อใหม่ จัดส่งเดลิเวอรี่ ยอด 120 บาท`
  - walkin 85 -> `มีรายการสั่งซื้อใหม่ สั่งที่หน้าร้าน ยอด 85 บาท`
  - takeaway 60 -> `มีรายการสั่งซื้อใหม่ สั่งกลับบ้าน ยอด 60 บาท`
  - table 150 with `tableCode: 12` -> `มีรายการสั่งซื้อใหม่ สั่งที่โต๊ะ ยอด 150 บาท`
  - dine_in 90 with a table code -> `มีรายการสั่งซื้อใหม่ สั่งที่โต๊ะ ยอด 90 บาท`.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.07.450` / `/react/assets/index-C9gHut3K.js`.
- `git diff --check` PASS.

Deploy state:
- Implementation commit/push pending.
- Firebase Hosting-only deploy pending.
- No Firestore Rules, Storage Rules, Cloud Functions, or schema change required.
- No merge to `main`.

Production deploy + verification:
- Implementation commit: `d58852b2` — `fix: localize spoken order channels`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production React bundle is `/react/assets/index-C9gHut3K.js` for React Build `2026.10.07.450` / Public Build `2026.10.07.165`.
- Production HTTP checks: `/cashier` = 200, `/kitchen` = 200, bundle = 200, `app-info.js` = 200.
- Production Cashier shell references `/react/assets/index-C9gHut3K.js`.
- Production `app-info.js` reports Build `2026.10.07.165`, commit marker `THAI-ORDER-ALERT-SPEECH`, and milestone `Natural Thai order alert speech`.
- Downloaded Production bundle contains all required speech markers: `มีรายการสั่งซื้อใหม่`, `จัดส่งเดลิเวอรี่`, `สั่งที่หน้าร้าน`, `สั่งกลับบ้าน`, and `สั่งที่โต๊ะ`.
- No Firestore Rules, Storage Rules, Cloud Functions, or schema deployment occurred.
- No merge to `main`.

---

## 2026-10-07 — Retail POS Backup + Users canonical React cutover

User request:
- Proceed with the planned cutover of `/pos/backup` and `/pos/users` from the remaining legacy HTML/JavaScript implementations to their existing React routes.
- Preserve functionality first, then remove the page-specific legacy HTML/JavaScript implementation safely.

Discovery / root cause:
- `PosBackupPage.jsx` and `PosUsersPage.jsx` already existed and were mounted in React Router, but the canonical Firebase Hosting paths still served physical legacy `public/pos/backup/index.html` and `public/pos/users/index.html` files.
- `tools/sync-react-legacy-entrypoints.py` did not include those two paths, so React postbuild never replaced them with the React shell.
- Production source checks before the cutover confirmed `/pos/backup` still loaded `retail-pos-backup.js` and `/pos/users` still loaded `retail-pos-users.js`.
- The dormant React pages were not fully parity-ready:
  - Backup had an unexercised missing React hook import and depended on Backup callables that were not deployed in Production.
  - Users used generic staff callables with fixed roles, so custom POS roles/password updates and legacy granular role actions would regress if cut over directly.

Implementation:
- Added canonical React shell sync targets for `public/pos/backup/index.html` and `public/pos/users/index.html`.
- Added no-cache Hosting headers for `/pos/backup`, `/pos/backup/**`, `/pos/users`, and `/pos/users/**`.
- Removed page-specific legacy logic files:
  - `public/assets/js/retail-pos-backup.js`
  - `public/assets/js/retail-pos-users.js`
- Preserved the previously approved visual treatment by copying the route visual CSS into the React parity CSS tree and loading it from the React pages.

React Backup:
- Fixed the dormant hook import and retained owner/super_admin access gating.
- Uses `exportRetailPosBackup` / `restoreRetailPosBackup` Firebase callables.
- Added read-only backup summary loading, drag/drop JSON selection, stable legacy action IDs, and the approved responsive Backup visual workspace.
- Updated Backup copy to use the existing TH/EN/MY/LO/KM catalog with Firebase-era wording that accurately states Firestore is backed up while Firebase Authentication accounts and Storage images are not deleted/recreated during restore.
- Old pre-React backup files remain intentionally rejected rather than being silently restored into an unverifiable tenant; the React/Firebase format is `app: retail-pos-react`, version `1`.

React Users:
- Added `react-app/src/data/retailPosStaffData.js` to read POS staff from the tenant memberships collection and use the existing `upsertRetailPosStaff` callable.
- Restored parity capabilities before cutover:
  - custom role creation/deletion;
  - role name editing;
  - menu permissions;
  - granular action permissions;
  - select/clear all per permission group;
  - POS user add/edit;
  - optional password change for existing users;
  - active/suspended state;
  - Retail POS / both-systems scope.
- `loadPosRoleSettings()` now falls back from `settings/pos-roles` to legacy `settings/roles` so existing custom roles/permissions carry forward on first React use.
- Updated `upsertRetailPosStaff` source to accept `businessScope: retail_pos|both` while preserving `source: pos`, `staffScope: pos`, and compatible business-unit markers.
- Reused the approved Users role/user visual workspace and stable IDs/selectors.

Regression protection:
- Replaced legacy Backup/Users foundation assertions with canonical React cutover assertions.
- Guards now require React routes, canonical entrypoint sync, Hosting cache headers, Backup/Users stable action IDs, visual parity, custom/granular role capabilities, password support, legacy-role fallback, five-language Backup copy, and removal of both page-specific legacy JavaScript files.
- Added `/pos/backup` to required React migration coverage.

Candidate verification before Functions deploy:
- Authenticated Chrome Owner profile successfully loads the local React candidate shell for both canonical paths against Production data.
- `/pos/users` candidate: 5 real roles, 3 real POS users, 19 permission groups, Add Role/Add User controls present, no horizontal overflow, no Firestore writes.
- `/pos/backup` candidate React UI loads with no legacy script and no overflow, but Production returned CORS for `exportRetailPosBackup`, confirming the Backup callables had never been deployed; this dependency must be deployed before Hosting cutover.
- A platform Super Admin profile without tenant context correctly redirects away from tenant POS pages; no authorization bypass was attempted.

Verification:
- `node --check functions/retail-pos-staff.js` PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React foundation/migration/callable/tenant-access/UI-layer contracts PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for React Build `2026.10.07.451` / `/react/assets/index-COzhMO-y.js`.
- Postbuild sync explicitly reports both `public/pos/backup/index.html` and `public/pos/users/index.html` synced to the React shell.
- `git diff --check` PASS.

Release candidate:
- React `0.4.280` / Build `2026.10.07.451`.
- Public `0.16.32` / Build `2026.10.07.166`.

Deploy state:
- Implementation commit/push pending.
- Required Functions deploy pending: `exportRetailPosBackup`, `restoreRetailPosBackup`, `upsertRetailPosStaff`.
- Firebase Hosting deploy pending.
- No Firestore Rules, Storage Rules, or schema change required.
- No merge to `main`.

### 2026-10-07 continuation — Backup v2 typed/scoped restore safety before Hosting cutover

Checkpoint after the initial cutover implementation:
- Commit `ea0d1d2e` — `feat: cut over POS backup and users to React` was pushed to `origin/feature/react-firebase-port`.
- Initial Functions deployment succeeded for:
  - `exportRetailPosBackup`
  - `restoreRetailPosBackup`
  - `upsertRetailPosStaff`
- After Cloud Functions propagation, authenticated Owner candidate verification against Production data passed:
  - Backup candidate loaded the React shell with no legacy Backup script.
  - Real backup download succeeded and contained 1,997 products plus all original v1 collection keys.
  - Users candidate loaded 5 roles, 3 POS users, and 19 permission groups.
  - Add Role local UI behavior, Edit User dialog, password fields, Retail POS/both scope options, and desktop/mobile horizontal overflow checks passed.
  - No page errors, console errors, request failures, HTTP errors, or Firestore writes were observed.
- No Production Restore action was executed.

Additional restore-safety audit before Hosting deploy:
- Found that backup v1 converted Firestore Timestamp values to strings. Restoring v1 could therefore change Firestore field types.
- Found that `tenants/{tenant}/settings` is shared with Admin/Delivery/Lalamove. Clearing the whole settings collection would be unsafe.
- Found that `tenants/{tenant}/counters` is shared with Operational Orders through `order_queue_*` documents.
- Found that `tenants/{tenant}/heldBills` is shared:
  - Retail POS uses `source: retail_pos`.
  - Quick Order uses `source: quick_order`.
- Therefore Hosting remained undeployed while restore safety was corrected.

Backup v2 implementation:
- Backup format is now `app: retail-pos-react`, version `2`, codec `firestore-types-v1`.
- Added `functions/retail-pos-backup-codec.js` to round-trip Firestore typed values:
  - Timestamp with seconds + nanoseconds;
  - GeoPoint;
  - DocumentReference;
  - bytes;
  - Date;
  - NaN / positive Infinity / negative Infinity.
- React explicitly rejects version 1 restore files with a five-language safety message and accepts only compatible v2 files.
- Added POS integrity collections required for safe restore continuity:
  - `dailySummary`
  - `saleItems`
  - `counters`
  - `runningNumbers`
  - `syncQueue`
  - `taxBuyerProfiles`
- Export collection reads run in parallel.
- Restore pre-decodes/validates rows before destructive collection writes.
- POS settings are now whitelisted to:
  - `retailPos`, `tax`, `payment`, `receipt`, `loyalty`, `pos-theme`, `pos-roles`, `roles`, `catalog-order`.
- Shared settings such as `settings/store`, Lalamove, and Lalamove Wallet are not cleared or overwritten.
- Shared Firestore collections are scoped during both backup and restore:
  - `counters` / `runningNumbers`: POS prefixes only (`SALE_`, `TAX_`, `REFUND_`, `VOID_`, `SHIFT_`);
  - `dailySummary` / `syncQueue`: POS channel/order/schema markers only;
  - `heldBills`: `source: retail_pos` only, preserving Quick Order held bills.
- Firebase Authentication accounts and Storage image files remain intentionally outside restore.

Verification after v2 safety changes:
- `node --check functions/retail-pos-backup.js` PASS.
- `node --check functions/retail-pos-backup-codec.js` PASS.
- Backup codec round-trip test PASS, including Timestamp nanosecond fidelity.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React foundation contract includes typed/scoped Backup regression protection and PASSes.
- `git diff --check` PASS.

Release candidate after safety repair:
- React `0.4.280` / Build `2026.10.07.452`.
- Public `0.16.32` / Build `2026.10.07.167`.
- Marker: `POS-BACKUP-TYPED-SCOPED-RESTORE`.

Deploy state:
- Backup v2 Functions deployment pending.
- React Build 452 production build pending.
- Firebase Hosting cutover remains pending.
- No Firestore Rules or Storage Rules change required.
- No merge to `main`.

### Backup v2 Functions deploy + final pre-Hosting candidate verification

Deployment:
- exportRetailPosBackup v2 updated successfully in asia-southeast1.
- restoreRetailPosBackup v2 updated successfully in asia-southeast1.
- The earlier upsertRetailPosStaff update remains deployed.
- Firebase Hosting is still intentionally not deployed at this checkpoint.

Authenticated Owner candidate verification against Production data:
- Candidate React bundle: /react/assets/index-D1Q6l4Rg.js / Build 2026.10.07.452.
- /pos/backup:
  - React shell loaded with no legacy Backup script.
  - 14 visible summary groups loaded successfully.
  - Products: 1,997; categories: 49; sales: 11; customers: 5; loyalty entries: 11; stock movements: 102; shifts: 8; tax invoices: 1.
  - Backup download succeeded as retail-pos-react version 2, codec firestore-types-v1.
  - Download contains the expected POS integrity collections, including dailySummary, counters, runningNumbers, saleItems, syncQueue, and taxBuyerProfiles.
  - Typed Firestore markers found in the real file: 2,639.
  - Backup settings IDs were only: retailPos, tax, payment, receipt, loyalty, pos-theme, catalog-order.
  - Shared-setting leak check: none.
  - Non-POS counter leak check: none.
  - Non-POS running-number leak check: none.
  - Non-POS held-bill leak check: none.
  - Restore button remained disabled because no restore file/confirmation was supplied.
- /pos/users:
  - 5 real roles.
  - 3 real POS users.
  - 19 permission groups.
  - Add Role local UI behavior passed.
  - Edit User dialog opened with email read-only, two password fields, and Retail POS / both-system scope options.
  - Desktop and mobile horizontal overflow = 0.
- Harness observed:
  - Firestore writes: 0.
  - page errors: 0.
  - console errors: 0.
  - request failures: 0.
  - HTTP errors: 0.
- No Production Restore action has been executed.

Deploy state:
- Safe to proceed with Firebase Hosting Build 2026.10.07.452.
- No Firestore Rules or Storage Rules deployment required.
- No merge to main.

### Production Hosting cutover + final live verification

Firebase Hosting:
- Deployed target foodapp successfully to https://penguin-food.web.app.
- Production canonical /pos/backup and /pos/users now serve the React shell for Build 2026.10.07.452.
- Both routes return HTTP 200 with Cache-Control: no-cache, no-store, must-revalidate.
- Both canonical shells reference /react/assets/index-D1Q6l4Rg.js.
- Production app-info.js reports Public Build 2026.10.07.167, marker POS-BACKUP-TYPED-SCOPED-RESTORE, milestone Retail POS React cutover with safe typed restore.
- Production bundle /react/assets/index-D1Q6l4Rg.js returns HTTP 200.

Authenticated Production Owner smoke verification:
- /pos/backup live read-only:
  - title: สำรองและกู้คืนข้อมูล POS.
  - bundle: /react/assets/index-D1Q6l4Rg.js.
  - legacy Backup script: absent.
  - 14 summary groups loaded from the deployed Backup callable.
  - Summary includes 1,997 products, 49 categories, 11 sales, 5 customers, 11 loyalty entries, 102 stock movements, 8 shifts, 1 tax invoice, and 7 POS settings.
  - horizontal overflow: 0.
  - application error text: empty.
  - Restore button remained disabled; no restore was run.
- /pos/users live:
  - title: ผู้ใช้และสิทธิ์.
  - bundle: /react/assets/index-D1Q6l4Rg.js.
  - legacy Users script: absent.
  - 5 roles, 3 POS users, 19 permission groups loaded.
  - desktop horizontal overflow: 0.
  - mobile horizontal overflow: 0.
  - application error text: empty.
- The only browser console 404 was /favicon.ico. The repository currently has no favicon asset and the React shell has no favicon link. This is unrelated to Backup/Users logic, callables, or bundle loading and was not changed as part of this cutover.
- No page errors, callable/request failures, or Backup/Users HTTP failures were observed in the read-only live checks.
- No Production Restore was executed and no user/role write was performed during final smoke verification.

Final cutover state:
- /pos/backup: canonical React Production route.
- /pos/users: canonical React Production route.
- Legacy page-specific Backup/Users JavaScript remains removed.
- Backup v2 typed/scoped export is deployed.
- Backup v2 safe restore callable is deployed but was intentionally not executed against Production data.
- upsertRetailPosStaff business-scope update is deployed.
- No Firestore Rules or Storage Rules deployment was required.
- No merge to main.

---

## 2026-10-07 — Table/Walk-in serving and table settlement lifecycle repair

User request:
- Restore per-item serving in Kitchen for Table and Walk-in orders.
- After Kitchen serving + Cashier payment, remove the completed order and close the QR table regardless of which action happens first.
- Add an explicit close-table action for Walk-in customers seated at a table.
- Restore the previous current-round cart layout shown in the supplied reference: item/price + quantity on the first row, full-width note input on the second row.

Root causes:
- Legacy kitchen-item-serve.js had per-item serving, but React KitchenPage did not migrate it.
- React table closing depended on client action order. Payment-first then serving left paid+served rows and the table occupied.
- Walk-in table management supported moving tables but not releasing a table while preserving order history.
- React PublicCartList kept the note input inside the item-info column instead of the legacy full-width second grid row.

Implementation:
- Added settleTableSession callable with Firestore transaction settlement for owner/admin/manager/cashier/kitchen/super_admin.
- Settlement ignores waiting-queue round-0 placeholders, normalizes paid+served rounds to paid/completed, and releases QR session/token/table occupancy only when all real rounds are terminal or paid+served.
- Added closeWalkInTable callable. It releases Walk-in occupancy while preserving the order and historical tableCode/tableName; the order receives tableClosedAt and tableOccupancyStatus=closed.
- Added React data wrappers and Functions exports for both new callables.
- Kitchen now restores per-item เสิร์ฟรายการนี้ for Table and Walk-in ready orders. Served rows lock individually; final item sets served or paid depending on payment status and then settles Table sessions.
- Kitchen and Cashier include stale paid+served Table auto-repair so existing stuck sessions self-heal after deployment.
- Cashier table payment now calls settlement after payment writes rather than deciding table close from stale client state.
- Walk-in cards on /cashier/table-qr now include a red ปิดโต๊ะ action with a warning that order history is preserved.
- PublicCartList now natively uses cart-row-aligned, cart-item-info, and a root data-note input, restoring the old two-row current-round layout.
- Added TH/EN/MY/LO/KM translations and updated operational/foundation/P0 regression contracts.

Verification before deploy:
- Operational helper tests PASS for waiting-queue placeholder and fully-served detection.
- node --check functions/operational-orders.js PASS.
- node --check functions/index.js PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS; callable contract = 57 references / 0 missing exports.
- npm run build:react PASS.
- Generated build contract PASS: React Build 2026.10.07.453 / /react/assets/index-B-FB6yXp.js.
- git diff --check PASS.
- Read-only candidate on real Production data: one Walk-in card has one ปิดโต๊ะ button; no overflow.
- Current-round candidate row 404px / note input 404px, ratio 1.000, note below item/quantity row; no overflow.
- Current Production paid+served Table data triggered the candidate auto-repair scan. The new callable was intentionally not deployed yet, so no Production mutation occurred.
- Firestore writes during candidate verification: 0.

Release candidate:
- React 0.4.280 / Build 2026.10.07.453.
- Public 0.16.32 / Build 2026.10.07.168.
- Marker TABLE-SERVICE-SETTLEMENT-REPAIR.

Deploy state:
- Implementation commit/push pending.
- Functions settleTableSession and closeWalkInTable pending.
- Hosting Build 453 pending.
- No Firestore Rules, Storage Rules, or schema migration required.
- No merge to main.

Production deploy + live verification:
- Implementation commit: `3194189d` — `fix: repair table service settlement lifecycle`.
- Commit pushed to `origin/feature/react-firebase-port`.
- Functions deployed successfully in `asia-southeast1`:
  - `settleTableSession`
  - `closeWalkInTable`
- Both callable endpoints return healthy CORS headers for `https://penguin-food.web.app`.
- Firebase Hosting target `foodapp` deployed successfully with React Build `2026.10.07.453` / Public Build `2026.10.07.168`.
- Production React bundle is `/react/assets/index-B-FB6yXp.js`.

Real stuck Table 12 repair:
- Before callable propagation, Production Cashier still showed Table 12 as kitchen served + payment paid, and `/cashier/table-qr` still showed Table 12 under issued QR tables.
- After `settleTableSession` became available, the Build 453 stale-settlement repair invoked the server transaction against the real stuck session.
- Result:
  - Table 12 disappeared from Cashier.
  - Table 12 disappeared from Kitchen.
  - Issued QR tables became empty.
  - Table 12 returned to the Available Tables list.
- This confirms the repair closes the actual session state and releases the table; it is not a UI-only hide.
- Browser direct Firestore writes during this verification were zero; the repair mutation occurred through the intended callable transaction.

Final Production smoke:
- Cashier loads `/react/assets/index-B-FB6yXp.js`; Table 12 is no longer active; horizontal overflow = 0.
- Kitchen loads the same bundle; Table 12 is no longer active; horizontal overflow = 0.
- No ready live Table/Walk-in order remained after the repair, so the new per-item serve button was not clicked against customer Production data. Source, contracts, generated bundle, and translations all contain the per-item serve path.
- `/cashier/table-qr`:
  - occupied QR tables = 0;
  - available tables include Table 12;
  - Walk-in Table 01 remains occupied;
  - Walk-in card has exactly one `ปิดโต๊ะ` button on Desktop and Mobile;
  - the real Walk-in close button was intentionally not clicked because Table 01 is an active customer state.
- Table Order current-round candidate verification measured the restored note layout at row 404 px / note 404 px, full-width ratio 1.000, with note below item/quantity controls.
- Deployed bundle markers confirmed:
  - `เสิร์ฟรายการนี้`
  - Walk-in close warning
  - `cart-row cart-row-aligned`
  - `data-close-walkin-table`
  - `settleTableSession`.
- Final live page/API errors = 0; no related HTTP failures were observed.
- No Firestore Rules, Storage Rules, or schema deployment was required.
- No merge to `main`.

---

## 2026-10-07 — Modern Table QR workspace + circular current-round quantity controls

User request:
- Refresh `/cashier/table-qr` to a more modern visual style while keeping the existing green palette.
- Add an icon to the QR print-again button.
- Make the current-round Table Order plus/minus quantity controls circular.

Implementation:
- Added route-specific React parity stylesheet `cashier-table-qr-modern.css`.
- Table QR Hero now has a QR-scan icon treatment, preserved green gradient, softer depth, and modern rounded surface.
- Paper-size control is now presented as a printer-themed modern panel while keeping the same 58 mm / 80 mm / A4 behavior.
- Available, issued, and Walk-in table cards now use consistent modern card hierarchy, semantic icons, rounded corners, subtle shadows, and existing green/status colors.
- Available-table issue action now has a QR icon.
- `พิมพ์อีกครั้ง` now includes the printer icon using the shared app-icon button pattern.
- Existing 4-card desktop Table QR layout, Walk-in actions, move-table controls, close-table lifecycle, and print CSS remain unchanged.
- `PublicCartList` now marks both current-round quantity buttons with `cart-qty-button`.
- React parity `app.css` renders these two controls as 34 x 34 px circles with subtle green hover/active feedback.
- The restored two-row current-round layout remains unchanged: item/quantity on top, full-width note below.
- Added React foundation regression coverage for the modern Table QR CSS/icon markup and circular quantity controls.

Verification:
- `npm run test:react-foundation` PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS: React Build `2026.10.07.454` / `/react/assets/index-DL7HiWhy.js`.
- `git diff --check` PASS.
- Read-only candidate against real Production data:
  - QR Desktop: 10 available cards, 4 equal grid columns (342.5 px each), hero radius 28 px, paper panel radius 20 px, table card radius 20 px.
  - QR Mobile: no horizontal overflow.
  - Hero QR icon, paper printer icon, and issue QR icon rendered.
  - Current-round minus/plus buttons: both 34 x 34 px, `border-radius: 50%`.
  - Note input remains full-width: 404 px note / 404 px row.
  - blocked browser Firestore writes: 0.
  - page errors: 0; console errors: 0; HTTP errors: 0.

Release candidate:
- React `0.4.280` / Build `2026.10.07.454`.
- Public `0.16.32` / Build `2026.10.07.169`.
- Marker: `TABLE-QR-MODERN-UI`.

Deploy state:
- Hosting deploy pending.
- No Function, Firestore Rules, Storage Rules, or schema change required.
- No merge to `main`.

Production deploy + verification:
- Implementation commit `c32b9022` — `style: modernize table QR workspace` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully.
- Production release: React `0.4.280` / Build `2026.10.07.454`; Public `0.16.32` / Build `2026.10.07.169`.
- Production bundle: `/react/assets/index-DL7HiWhy.js`.
- `/cashier/table-qr` live verification:
  - QR Hero icon rendered.
  - paper-size printer icon rendered.
  - available-table QR action icon rendered.
  - desktop available-table grid remains four equal columns at the tested 1600 px viewport.
  - hero radius 28 px, paper panel radius 20 px, card radius 20 px.
  - horizontal overflow = 0.
- Table Order live verification:
  - minus and plus controls render 34 x 34 px with `border-radius: 50%`.
  - note input remains full-width at 404 px / row 404 px.
  - horizontal overflow = 0.
- No related page or HTTP errors.
- The only browser console 404 is the already-known `/favicon.ico`; it is unrelated to Table QR or current-round UI assets.
- No Function, Firestore Rules, Storage Rules, or schema deploy was required.
- No merge to `main`.

---

## 2026-10-07 — Replace current-round quantity text glyphs with real Bootstrap Icons

User report:
- The circular plus/minus controls in Table Order looked like alphabet/text characters rather than icons.

Root cause:
- The previous visual polish changed the button shape to circles, but `PublicCartList` still rendered literal Unicode text glyphs `−` and `+` inside the buttons.

Implementation:
- Replaced the literal glyphs with real Bootstrap Icons:
  - `bi bi-dash-lg` for decrease;
  - `bi bi-plus-lg` for increase.
- Kept the existing 34 x 34 px circular button styling and the restored two-row current-round cart layout.
- Added localized `order.cart.decrease` / `order.cart.increase` labels for TH / EN / MY / LO / KM and wired them to `aria-label` + `title`.
- Updated the React foundation regression guard so these controls cannot silently regress back to text glyphs.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS: React Build `2026.10.07.455` / `/react/assets/index-C4r_QqpA.js`.
- `git diff --check` PASS.
- Browser candidate verification with Google Chrome:
  - both buttons remain 34 x 34 px with `border-radius: 50%`;
  - visible button text is empty;
  - decrease markup is `<i class="bi bi-dash-lg">`;
  - increase markup is `<i class="bi bi-plus-lg">`;
  - pseudo-elements resolve through `font-family: bootstrap-icons`, confirming the icon font is actually rendering;
  - Thai accessible labels resolve to `ลดจำนวน` and `เพิ่มจำนวน`;
  - horizontal overflow = 0;
  - page/console/HTTP errors = 0.

Release candidate:
- React `0.4.280` / Build `2026.10.07.455`.
- Public `0.16.32` / Build `2026.10.07.170`.
- Marker: `TABLE-ORDER-QTY-ICONS`.

Deploy state:
- Hosting deploy pending.
- No Function, Firestore Rules, Storage Rules, or schema change required.
- No merge to `main`.

Production deploy + verification:
- Implementation commit `9b9cbde1` — `fix: use icons for table order quantity controls` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully.
- Production release: React `0.4.280` / Build `2026.10.07.455`; Public `0.16.32` / Build `2026.10.07.170`.
- Production bundle: `/react/assets/index-C4r_QqpA.js`.
- Production bundle SHA-256 exactly matches the locally tested candidate: `bbc05da260e34c9d3c69229c7fc3f8c81669b68cb79a831827f7905e3a549aca`.
- Production bundle contains `bi bi-dash-lg`, `bi bi-plus-lg`, localized quantity-label keys, and `cart-qty-button` markers.
- Therefore the Production artifact is the same artifact that browser verification confirmed renders through `font-family: bootstrap-icons` with empty button text.
- No Function, Firestore Rules, Storage Rules, or schema deploy was required.
- No merge to `main`.

---

## 2026-10-07 — Walk-in close-table confirmation icon deduplication

User report:
- In the Walk-in close-table confirmation dialog, the Cancel and Close Table actions both displayed the same X icon.

Root cause:
- `sweetDialog.js` automatically maps button labels containing `ปิด` / `close` to `x-lg`.
- The Walk-in confirm action label is `ปิดโต๊ะ`, so it received the same `x-lg` icon as the Cancel action.

Implementation:
- `CashierTableQrPage.jsx` now explicitly sets:
  - confirm icon = `door-closed`;
  - cancel icon = `x-lg`.
- This is scoped only to the Walk-in close-table confirmation and does not change icon inference for other dialogs.
- React foundation contract now guards these explicit icon assignments.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS: React Build `2026.10.07.456` / `/react/assets/index-B-7f69Ur.js`.
- `git diff --check` PASS.
- Browser candidate verification on real Walk-in card:
  - dialog title = `ปิดโต๊ะ Walk-in`;
  - confirm action = `ปิดโต๊ะ` with `bi bi-door-closed`;
  - cancel action = `ยกเลิก` with `bi bi-x-lg`;
  - icons are not the same;
  - dialog opened without confirming, so no customer state was changed;
  - blocked Firestore writes = 0;
  - page/console/HTTP errors = 0;
  - horizontal overflow = 0.

Release candidate:
- React `0.4.280` / Build `2026.10.07.456`.
- Public `0.16.32` / Build `2026.10.07.171`.
- Marker: `WALKIN-CLOSE-DIALOG-ICON`.

Deploy state:
- Hosting deploy pending.
- No Function, Firestore Rules, Storage Rules, or schema change required.
- No merge to `main`.

Production deploy + verification:
- Implementation commit `b490d373` — `fix: distinguish walk-in close dialog icons` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully.
- Production release: React `0.4.280` / Build `2026.10.07.456`; Public `0.16.32` / Build `2026.10.07.171`.
- Production bundle: `/react/assets/index-B-7f69Ur.js`.
- Live `/cashier/table-qr` Walk-in dialog verification:
  - title = `ปิดโต๊ะ Walk-in`;
  - confirm action `ปิดโต๊ะ` uses `bi bi-door-closed`;
  - cancel action `ยกเลิก` uses `bi bi-x-lg`;
  - `sameIcon = false`;
  - dialog was cancelled after inspection; no Walk-in table was closed;
  - horizontal overflow = 0;
  - page errors = 0; related HTTP errors = 0.
- One generic browser console 404 was observed without a paired response error, consistent with the existing favicon noise and unrelated to this dialog fix.
- No Function, Firestore Rules, Storage Rules, or schema deploy was required.
- No merge to `main`.


---

## 2026-10-07 — Full React system cutover

User directive:
- The application must be React across the whole frontend, not a mixed React + page-specific legacy HTML/JavaScript system.

Root cause / architecture gap:
- Most staff/admin/POS routes were already React, but physical legacy entrypoints still existed for Home, Delivery, Takeaway, Delivery Success, Verify, Privacy/Terms, Queue, POS Login/Forbidden, POS Catalog, Customer Display, Receipt, and Tax Invoice.
- Firebase Hosting still routed several storefront/POS paths to those physical legacy HTML files before React Router could handle them.
- Public Delivery still depended on the old `delivery.js` runtime and related page-specific modules for Google Maps/route calculation, Lalamove quotation, customer address book/favorites, promotions, PromptPay/payment lock, slip upload, and final order creation.
- Existing regression contracts still required selected static/legacy HTML behavior, so they would have forced the mixed architecture to remain.

Implementation:
- Added native React routes/components for:
  - `/s/:slug/delivery`
  - `/s/:slug/delivery/success`
  - `/s/:slug/takeaway`
  - `/verify`
  - `/privacy`
  - `/terms`
  - `/pos/forbidden`
  - legacy storefront compatibility entry handling.
- `/queue` now mounts the React customer queue page.
- `/pos/login` now canonicalizes to the shared React Login flow with `next=/pos/`; existing `LoginPage` still prepares the Retail POS session.
- Preserved old `/takeaway` behavior that can reopen the previously stored tenant context by redirecting to `/s/{slug}/takeaway`.
- Rebuilt Delivery in React/Firebase with:
  - live menu/cart;
  - guest + Google customer context isolated from staff auth;
  - saved addresses and favorites;
  - Google Maps pin/current-location picker;
  - Google Routes self-delivery calculation;
  - live Lalamove quotation + COD capability validation;
  - free shipping/free gift promotions;
  - PromptPay QR/payment lock;
  - payment-slip validation/upload;
  - final public delivery order creation;
  - Delivery Success receipt + realtime order watch + Verify QR.
- Extended `PublicMenuCatalog` with React favorite controls.
- Added five-locale cart/accessibility and delivery route translations.
- Updated Firebase Hosting rewrites so Delivery/Takeaway/Storefront/Verify/Order/Queue/POS fallback routes resolve to `/react/index.html`.
- Expanded `tools/sync-react-legacy-entrypoints.py` so all physical frontend `index.html` entrypoints are overwritten by the current React shell during postbuild.
- Strengthened generated-build and migration contracts:
  - every physical frontend `index.html` must reference the same current React bundle;
  - migration report must show React shell or scheduled postbuild sync;
  - Hosting frontend rewrites must target the React shell.
- Updated Waiting Queue back navigation to the React Home route.
- Removed page-specific legacy runtime files that no longer have a canonical consumer:
  - `delivery.js`
  - `delivery-success.js`
  - `takeaway-order.js`
  - `verify.js`
  - `waiting-queue-track.js`
  - `waiting-queue-legacy-customer.js`
  - `delivery-bootstrap.js`
  - `delivery-addresses.js`
  - `delivery-location-map.js`
  - `delivery-location-address-resolver.js`
  - `delivery-address-status-sync.js`
  - `delivery-payment-lock.js`
  - `delivery-button-click-fix.js`
  - `delivery-category-scroll-fix.js`
  - `delivery-promotions.js`
  - `delivery-favorites.js`
  - `delivery-staff-guard.js`.
- Shared services/assets that still have real dependencies were intentionally retained.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS after updating legacy-only contract assertions to React component contracts.
- `npm run build:react` PASS after the legacy runtime deletion.
- Generated React build contract PASS: React Build `2026.10.07.457` / `/react/assets/index-Dclizvbl.js`.
- Migration coverage: 53 routes, 21 POS routes, **52 React physical shells, 0 pending postbuild shell sync**.
- `git diff --check` PASS.
- Read-only browser verification against real Production data with Firestore writes blocked:
  - Takeaway React: menu data loaded, cart add works, no legacy script.
  - Delivery React: real menu, Google Map, Google customer login entry, address book, favorites UI, no raw translation keys.
  - Delivery geolocation/out-of-range handling works.
  - In-range Lalamove quotation verified at ~10.30 km / 77 THB.
  - PromptPay payment lock shows QR, QR download, slip upload surface, edit-items action, and locks menu changes.
  - Privacy / Terms / Verify are React.
  - legacy `/takeaway` stored-tenant compatibility redirects correctly.
  - `/delivery` without slug keeps the incomplete-link state.
  - `/queue` and `/pos/login` are React.
  - desktop/mobile horizontal overflow = 0.
  - legacy page-script requests = 0.
  - blocked Firestore writes = 0.
  - page errors = 0; console errors = 0; HTTP errors = 0.

Release candidate:
- React `0.4.280` / Build `2026.10.07.457`.
- Public `0.16.32` / Build `2026.10.07.172`.
- Marker: `FULL-REACT-SYSTEM-CUTOVER`.
- Final candidate bundle: `/react/assets/index-Dclizvbl.js`.

Production deploy + verification:
- Implementation/docs commit `872a04ab` — `feat: complete full React system cutover` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production release: React `0.4.280` / Build `2026.10.07.457`; Public `0.16.32` / Build `2026.10.07.172`.
- Production bundle: `/react/assets/index-Dclizvbl.js`.
- Live Production verification:
  - Home, Takeaway, Delivery, Privacy, Terms, Verify, Queue, and POS Login all loaded the same React bundle.
  - Takeaway loaded 10 real menu cards.
  - Delivery loaded 10 real menu cards, Google Map, and live Lalamove quote at ~10.30 km / 77 THB.
  - legacy `/takeaway` stored-tenant route redirected to `/s/saas-test-shop/takeaway`.
  - `/pos/login` redirected to React `/login?next=/pos/`.
  - removed `/assets/js/delivery.js` returned HTTP 404 as expected.
  - legacy page-script requests = 0.
  - blocked Firestore writes = 0.
  - horizontal overflow = 0.
  - page errors = 0; console errors = 0; related HTTP errors = 0.
  - `app-info.js` exposes Public Build `2026.10.07.172` and marker `FULL-REACT-SYSTEM-CUTOVER`.
- No Cloud Functions, Firestore Rules, Storage Rules, or schema deployment was required.
- No merge to `main`.


---

## 2026-10-07 — P0 production auth-boundary smoke timing repair

Symptom / investigation:
- Post-cutover Production P0 browser smoke initially reported 8 auth-boundary failures on selected Admin/Cashier routes even though route rendering itself was healthy.
- The failing assertion expected anonymous browsers to reach `/login` after a fixed 350 ms delay.

Root cause:
- Full React startup intentionally resolves Firebase auth, tenant state, and route CSS before page-level redirects on several protected screens.
- Direct timing measurements against Production confirmed every reported route did redirect correctly, but took roughly 0.9–1.7 seconds.
- During that interval only the existing loading/readiness UI was rendered; protected workspace content was not exposed.
- This was therefore a test timing false failure, not an authentication or tenant-data leak.

Change:
- Updated `tests/react-parity/p0-smoke.spec.mjs` auth-boundary assertions to wait for the actual `/login` URL condition with a 5-second ceiling instead of sleeping exactly 350 ms.
- Production runtime, auth logic, business logic, Firebase data paths, permissions, Functions, Rules, and release identity were not changed.

Verification:
- Measured all 8 initially failing routes individually; each reached `/login` in about 0.9–1.7 seconds.
- Production P0 browser smoke: **52/52 PASS**.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS at React Build `2026.10.07.457` / `/react/assets/index-Dclizvbl.js`.
- `git diff --check` PASS.
- React migration coverage remains 53 routes / 21 POS routes / 52 React physical shells / 0 pending shell sync.

Deploy state:
- Test/documentation-only repair; Production bundle and Build are unchanged.
- No Firebase Hosting, Functions, Firestore Rules, Storage Rules, or schema deploy is required for this change.
- No merge to `main`.
- Commit/push pending at the time of this worklog entry.


---

## 2026-10-07 — React-only frontend runtime cleanup

User directive:
- Remove the old frontend implementation from `feature/react-firebase-port` and leave the application React 100%.

Starting state:
- Full React route/shell cutover was already Production-deployed on React Build `2026.10.07.457`.
- All physical frontend entrypoints already mounted the React shell, but Firebase Hosting still contained the old `public/assets/js` and `public/assets/css` page runtimes plus several static vendor bridges and migration fixtures.

Implementation:
- Moved the global horizontal-scroll behavior into `react-app/src/ui/horizontalScrollEnhancer.js` and bundle it from `main.jsx`.
- Moved POS tax-invoice history sync/offline behavior into React-owned `react-app/src/data/retailPosTaxInvoiceData.js`, preserving tenant/local-cache fallback, Firestore paths, TAX running-number shape, sync, void, retry, buyer-profile and local-first semantics.
- Replaced SaaS Setup's dynamic legacy Sweet Dialog import with the shared React `sweetDialog` component.
- Replaced Platform receiver-account Select2/jQuery enhancement with the existing controlled React select without changing the saved `receiver.accountType` data shape.
- Delivery Success print now loads React parity CSS instead of `/assets/css`.
- Removed the complete hosted legacy runtime trees `public/assets/js`, `public/assets/css`, and stale `public/react/parity/js`.
- Removed the root `retail-pos.js` entry, unused Admin Tailwind build/config, and unused static jQuery/Select2/QRCode.js/SheetJS/SortableJS vendor copies. Bootstrap Icons static assets remain because React uses them as UI assets.
- Renamed `sync-react-legacy-entrypoints.py` to `sync-react-entrypoints.py`.
- Renamed the React compatibility component from `LegacyStorefrontEntry` to `StorefrontCompatibilityEntry`; the old `/takeaway` URL compatibility behavior remains and resolves into the canonical React tenant route.
- Removed migration-only legacy JS/HTML fixtures and the unused static P0 inventory builder/snapshot. Regression contracts now validate React source and explicit required action/DOM ID inventories directly.
- Added structural regression guards preventing hosted legacy JS/CSS runtime directories and the jQuery/Select2 bridge from returning.
- Removed obsolete legacy asset cache-header entries from Firebase Hosting config.
- Removed unused Tailwind dev dependency/build script.
- Prepared React Version `0.4.280` / Build `2026.10.07.458`, marker `REACT-ONLY-FRONTEND-RUNTIME`.

Verification:
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React migration coverage PASS: 53 routes / 21 POS routes / 52 React physical shells / 0 pending shell sync.
- React callable contract PASS: 59 references / 0 missing exports.
- `npm run build:react` PASS.
- Generated build contract PASS: Build `2026.10.07.458` / `/react/assets/index-Dr6zxvtM.js`.
- `git diff --check` PASS.
- Firebase Hosting emulator P0 canonical browser smoke: **52/52 PASS**.
- Candidate mobile browser audit on Home, Login, Waiting Queue, Privacy/Terms, Verify, Delivery, Takeaway and POS Login: legacyRequests=0, pageErrors=0, horizontal overflow=false, raw translation keys=false.
- Removed legacy asset endpoints for Admin/POS JS, global CSS, jQuery and Select2 return 404 in the Hosting emulator.
- Final structure audit: legacy-named project paths=0; `public/assets/js` absent; `public/assets/css` absent; `public/react/parity/js` absent; old POS fixtures absent; static P0 inventory absent; non-React physical shells=0.

Data/deployment boundary:
- No Firebase collection/schema/internal-ID rename.
- No Firestore Rules, Storage Rules, or Cloud Functions change/deploy is required.
- Existing React parity CSS, static fonts/images, Bootstrap Icons, compatibility URLs, and old hashed React bundles required by the stale-tab recovery policy remain intentionally.
- Hosting deployment for Build `.458` completed successfully after implementation commit `8a4044bc`.
- No merge to `main`.


---

## 2026-10-07 — React-only frontend runtime cleanup (Build 2026.10.07.458)

Request:
- Frontend must be React 100%; remove remaining page-specific legacy runtime instead of keeping hidden bridges beside React.
- Preserve business logic, Firebase paths/schema, permissions, compatibility URLs, and current React UI behavior.

Implementation:
- Removed Hosting-served legacy runtime trees: public/assets/js, public/assets/css, root retail-pos.js, and stale public/react/parity/js.
- Moved remaining runtime bridges into React-owned source:
  - horizontal scroll -> react-app/src/ui/horizontalScrollEnhancer.js
  - SaaS confirmation -> React sweetDialog
  - POS full-tax sync/offline behavior -> react-app/src/data/retailPosTaxInvoiceData.js
  - Platform receiver account type -> controlled React select; jQuery/Select2 bridge removed
- Preserved POS Tax Invoice tenant/cache/counter behavior, including legacy cache migration, document metadata cleanup, TAX monthly reservation numbering, and P9 schema/counter markers.
- Removed unused Hosting static runtimes: jQuery, Select2, QRCode.js, static SheetJS copy, and static SortableJS copy. Bootstrap Icons remains as a React UI asset.
- Kept npm xlsx installed because React POS Catalog still exposes Excel import UI; do not remove it until that feature is separately verified end-to-end.
- Removed obsolete admin Tailwind build script/config with no React consumer.
- Renamed sync-react-legacy-entrypoints.py -> sync-react-entrypoints.py.
- Renamed LegacyStorefrontEntry -> StorefrontCompatibilityEntry; compatibility URLs remain React Router based.
- Removed obsolete Firebase Hosting headers for deleted legacy JS.
- Added structural guards preventing the removed legacy runtime directories and jQuery/Select2 bridge from returning.

Verification:
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- Migration coverage PASS: 53 routes / 21 POS routes / 52 physical React shells / 0 pending shell sync.
- npm run build:react PASS.
- Generated React build contract PASS for Build 2026.10.07.458 / /react/assets/index-Dr6zxvtM.js.
- git diff --check PASS.
- Structural audit: public/assets/js absent; public/assets/css absent; public/react/parity/js absent; root retail-pos.js absent; non-React physical shells = 0; legacy runtime/vendor source refs = 0; missing current HTML/chunk refs = 0.
- Firebase Hosting emulator P0 browser smoke: 52/52 PASS.
- Extra mobile runtime audit across Home/Login/Waiting Queue/Privacy/Terms/Verify/Delivery/Takeaway/POS Login: legacy requests = 0, page errors = 0, horizontal overflow = 0, dependency HTTP 4xx = 0.
- Removed static endpoints such as /assets/js/admin.js, /assets/js/retail-pos.js, /assets/css/app.css, jQuery and Select2 return 404.
- /react/parity/js/toast-top-layer.js no longer exists as JavaScript; Hosting fallback returns text/html React shell and no route requests it.

Release candidate:
- React 0.4.280 / Build 2026.10.07.458.
- Marker REACT-ONLY-FRONTEND-RUNTIME.
- Current bundle /react/assets/index-Dr6zxvtM.js.
- Current shared chunks firebase-NSZn2s4d.js, react-vendor-C6B81y6D.js, rolldown-runtime-hePW80VL.js.

Scope / safety:
- No reset / clean / discard.
- No merge to main.
- No Functions, Firestore Rules, Storage Rules, or schema change.
- This establishes a React-only frontend runtime. It does not claim every authenticated/data-writing parity action has 100% automated side-effect verification; that broader verification program remains tracked separately.

Commit / push / deploy:
- Implementation commit `8a4044bc` — `refactor: remove legacy frontend runtime` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production loads `/react/assets/index-Dr6zxvtM.js` plus `firebase-NSZn2s4d.js`, `react-vendor-C6B81y6D.js`, and `rolldown-runtime-hePW80VL.js`.
- Production P0 browser smoke: **52/52 PASS**.
- Production removed endpoints for Admin/POS legacy JS, global legacy CSS, jQuery, and Select2 return HTTP 404.
- `/react/index.html` canonicalizes with HTTP 301 to `/react`; root Production shell and browser resource inspection confirm Build `.458` assets are live.
- Deployment scope was Hosting only. No Functions, Firestore Rules, Storage Rules, schema deploy, or merge to `main`.


---

## 2026-10-07 — Replace visible Super Admin wording with localized Administrator labels

Request:
- Remove user-visible "Super Admin" wording from the React frontend.
- Thai must show "ผู้ดูแลระบบ".
- All supported languages must use the normal translation system.
- Keep the internal role ID `super_admin`, permissions, routes, Firebase schema, and business logic unchanged.

Implementation:
- Updated all user-visible translation strings containing "Super Admin" across `th`, `en`, `my`, `lo`, and `km`.
- Role labels now resolve as:
  - th: ผู้ดูแลระบบ
  - en: Administrator
  - my: အုပ်ချုပ်ရေးမှူး
  - lo: ຜູ້ບໍລິຫານ
  - km: អ្នកគ្រប់គ្រង
- Refactored `UserMenu.jsx` so role labels, greeting, navigation labels, and logout use `shared.user_menu.*` i18n keys instead of hardcoded Thai/English fallbacks.
- Replaced the Platform Control Card default "Super Admin" badge with the localized role label.
- Added regression coverage that fails if "Super Admin" returns in React translations or User Menu visible copy.
- Internal `super_admin` role checks and canonical `/super-admin/saas-setup` route are intentionally unchanged.

Release candidate:
- React Version `0.4.280`
- Build `2026.10.07.459`
- marker `ADMINISTRATOR-VISIBLE-LABELS`
- candidate bundle `/react/assets/index-Ddo9H8Ck.js`

Verification:
- React source visible wording audit: 0 occurrences of "Super Admin".
- Generated candidate bundle: 0 occurrences of "Super Admin".
- `npm run test:react-foundation` PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.07.459`.
- `git diff --check` PASS.
- Firebase Hosting emulator P0 browser smoke: **52/52 PASS**, including language-switch coverage.

Deploy state:
- Implementation commit `56053982` — `fix: localize administrator visible labels` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle `/react/assets/index-Ddo9H8Ck.js` contains 0 occurrences of the old user-visible wording.
- Production P0 browser smoke: **52/52 PASS**.
- Deployment scope was Hosting only.
- No Functions, Firestore Rules, Storage Rules, schema, or main-branch merge changes.


---

## 2026-10-07 — Delivery Laravel visual parity pass (Build 2026.10.07.460)

Request:
- After the React-only cutover, Delivery was the remaining page with noticeable visual/layout drift.
- Compare directly against Laravel MASTER instead of asking the user to enumerate every visual difference.
- Preserve React/Firebase delivery business logic.

Laravel baseline:
- Project: /Users/natchanonsripleng/Desktop/Sites/food-order-app-php80
- Branch: main
- Reference view: resources/views/migrated/delivery.blade.php
- Reference CSS/behavior: Delivery/address/map/payment/favorites/workspace assets under public/assets.
- React remained on feature/react-firebase-port; no reset/clean/discard and no merge to main.

Parity corrections:
- Restored Laravel body class parity: customer-order-page.
- Restored Laravel Delivery CSS order and added the two missing Google account styles:
  - delivery-google-normal-button.css
  - delivery-google-font-mobile-spacing.css
- Replaced React-diverged delivery-addresses.css with the Laravel MASTER copy.
- Reworked the customer account block to use the Laravel visual structure and hooks while retaining React customer-auth handlers:
  - customerAccount / customerAccountName / customerModeText
  - delivery-google-button-slot
  - googleLoginButton using google-login-button delivery-google-login-button
  - Google logo asset
  - customerLogoutButton
- Restored Laravel DOM hooks across contact/address book/map:
  recipient inputs, address status, address book/form controls, map picker/status/coordinates, and current-location action.
- Restored deliveryDistanceStatus and kept the delivery-zone control visible like Laravel:
  - manual mode remains editable
  - Google Routes/Lalamove automatic modes remain disabled/read-only
  - automatic delivery calculation behavior is unchanged.
- Fixed the React loading state so an in-progress menu load shows common.loading instead of the failure message.
- Restored Laravel payment structure/hooks:
  promptPaySection, paymentLockPanel/state/summary/actions, PromptPay placeholder/QR/amount/name, payment-slip wrapper/dropzone/preview/error/remove controls.
- Restored remaining Laravel visual IDs for hero, menu search/pagination, cart, free-gift area, subtotal/delivery fee/free-shipping, note/payment method, submit action, and cart total.
- PublicMenuCatalog/PublicCartList gained optional IDs only; callers that do not pass them are unchanged.
- Added Delivery parity assertions to the React foundation contract.
- Kept React/Firebase Maps, Lalamove quotation/COD, promotions, favorites, PromptPay generation, slip upload, customer data, and order creation logic intact.
- Confirmed Laravel itself uses the sticky/scrollable desktop Delivery side column through pos-refresh.css, so that behavior was intentionally preserved rather than removed.

Verification:
- Static Laravel Blade parity audit: 0 missing Delivery IDs in React; the only apparent missing class is bi-credit-card, which React generates dynamically at runtime.
- npm run test:react-foundation PASS.
- npm run test:operational PASS.
- npm run test:react-parity PASS.
- Migration coverage PASS: 53 routes / 21 POS routes / 52 React shells / 0 pending shell sync.
- npm run build:react PASS.
- Generated React build contract PASS for Build 2026.10.07.460 / /react/assets/index-B3zQsc0z.js.
- git diff --check PASS.
- Hosting-emulator Delivery audit using real tenant saas-test-shop:
  - desktop 1440x1000 and mobile 390x844
  - no horizontal overflow
  - real menus load (10 paged cards desktop / 37 cards mobile)
  - Google login fills the account-card width
  - deliveryZone exists and is disabled in automatic mode
  - payment lock/placeholder structures exist
  - first Add action updates cart 0 -> 1, total 0.00 -> 120.00, and creates one cart row
  - no page errors
- Hosting-emulator P0 browser smoke: 52/52 PASS.
- Visual screenshots were reviewed for the top workspace and the Map/Delivery Zone/Payment sections on desktop and mobile; temporary screenshots were removed before commit.

Release candidate:
- React Version 0.4.280
- Build 2026.10.07.460
- marker DELIVERY-LARAVEL-VISUAL-PARITY
- bundle /react/assets/index-B3zQsc0z.js

Deploy state:
- Implementation commit `b08516f7` — `fix: restore delivery laravel visual parity` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle is `/react/assets/index-B3zQsc0z.js`.
- Production Delivery targeted audit using `saas-test-shop` passed on desktop/mobile:
  - no horizontal overflow or page errors
  - real menus load
  - Google account width/layout matches the card
  - automatic delivery zone is visible/read-only
  - PromptPay lock/placeholder structure is present
  - Add item updates cart count and total correctly
  - no relevant HTTP 4xx dependencies
- Production P0 browser smoke: **52/52 PASS**.
- Deployment scope was Hosting only.
- No Functions, Firestore Rules, Storage Rules, schema change, or merge to main.


---

## 2026-10-07 — Delivery address/action parity repair (Build 2026.10.07.461)

Request:
- Match the PromptPay action labels to Laravel: short `ดาวน์โหลด` / `แก้ไข`.
- Repair Delivery button icons that appeared clipped or incomplete after the React-only cutover.
- Restore automatic matching of the nearest saved customer address when using the device current location.
- Restore the previously approved signed-in customer logout control as an icon-only action on the same row as the customer name.

Implementation:
- PromptPay locked actions now use existing localized Laravel-parity keys:
  - `delivery.checkout.payment_lock.download_short`
  - `delivery.checkout.payment_lock.edit_short`
- Added Delivery-specific icon sizing/overflow guards so button icons remain fully visible.
- Restored the payment-slip remove action as icon-only, circular overlay, with localized `aria-label` / `title`.
- Restored the approved customer account layout:
  - `delivery-account-card`
  - `delivery-account-user-row`
  - customer name and logout icon share the same row
  - logout is icon-only `bi-box-arrow-right`; no visible logout text
  - Google login slot stays hidden while signed in.
- Ported Laravel nearest-saved-address behavior from `delivery-location-address-resolver.js` into React:
  - current-location and map actions now carry an explicit source
  - Haversine distance is calculated client-side
  - saved address auto-select threshold is exactly 100 meters, matching Laravel
  - auto-select occurs only for `current-location`, not explicit map click/drag
  - if GPS arrives before the profile finishes loading, React re-checks once the saved addresses are ready
  - selecting a matching address restores saved recipient name, phone, address text, and saved coordinates.
- Added saved-address radio values using the address ID so selection state is explicit in the DOM.
- Preserved manually typed address text when current location has no nearby saved-address match.
- No new callable/backend dependency was introduced. An existing unexported reverse-geocode implementation was intentionally not wired into React in this change, so the deployment remains Hosting-only.
- Added regression assertions for nearest-address threshold/source behavior, short PromptPay labels, icon-only logout structure, and Delivery payment icon CSS.

Verification:
- `npm run test:react-foundation` PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React callable contract: 59 references / 0 missing exports.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.07.461` / `/react/assets/index-DPioHuf3.js`.
- `git diff --check` PASS.
- Hosting-emulator nearest-address scenario using mock GPS:
  - saved address ID `near-store-home` selected automatically
  - saved address text restored
  - recipient name and phone restored
  - threshold behavior is based on the Laravel 100-meter rule.
- Hosting-emulator serviceable Lalamove scenario near the real test-store location:
  - Lalamove quote ready at about 0.10 km
  - PromptPay locks successfully
  - buttons render exactly `ดาวน์โหลด` / `แก้ไข`
  - download and edit icons are present
  - payment-slip remove action is icon-only 42x42 with a 20x20 icon
  - all visible Delivery button icons in the tested flow are inside their button bounds; clipped icon count = 0
  - no page errors.
- Signed-in account CSS/DOM layout check:
  - logout button is icon-only 30x30
  - one icon child / no visible text
  - icon is 18x18 and inside the button
  - button and customer name are vertically centered on the same row
  - signed-in Google button slot is hidden.
- Hosting-emulator P0 browser smoke: **52/52 PASS**.

Release candidate:
- React Version `0.4.280`
- Build `2026.10.07.461`
- marker `DELIVERY-ADDRESS-ACTION-PARITY`
- bundle `/react/assets/index-DPioHuf3.js`

Deploy state:
- Implementation commit `a589a1e8` — `fix: restore delivery address and action parity` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle is `/react/assets/index-DPioHuf3.js`.
- Production targeted Delivery audit passed with a guest saved-address + mock-GPS scenario:
  - nearest saved address auto-selected within the Laravel 100-meter rule
  - live Lalamove quote became ready at about 0.10 km
  - PromptPay actions render exactly `ดาวน์โหลด` / `แก้ไข`
  - visible Delivery button icon clipping count = 0
  - payment-slip remove button is icon-only 42x42
  - logout layout is icon-only 30x30 on the same row as customer name
  - no page errors or relevant HTTP errors.
- Production P0 browser smoke: **52/52 PASS**.
- Deployment scope was Hosting only.
- No Functions, Firestore Rules, Storage Rules, schema changes, or merge to `main`.


---

## 2026-10-07 — Delivery parity TDD repair (Build 2026.10.07.462)

Request:
- Use test-first workflow before fixing Delivery parity regressions.
- Saved-address radio must auto-select like Laravel.
- Saved-address actions must include icons.
- PromptPay locked layout must visually follow the Laravel runtime order shown side-by-side by the user.

Test-first evidence:
- Added `tests/react-parity/delivery-parity.spec.mjs` before changing runtime code.
- Initial run against Build 2026.10.07.461 failed 3/3:
  1. default saved-address radio remained unchecked,
  2. Edit / Set default / Delete had no icons,
  3. `paymentLockPanel` appeared before QR/account instead of after it.
- Added `npm run test:delivery-parity-browser` and included it in `test:react-parity-full`.

Laravel MASTER baseline:
- Profile load chooses `addresses.find(item => item.isDefault) || addresses[0]` and marks it selected.
- PromptPay runtime inserts `paymentLockPanel` after QR + amount + account name and before payment slip.

Implementation:
- Customer profile load now automatically selects the default saved address, falling back to the first saved address.
- Auto-selection restores recipient name, phone, delivery text, and saved coordinates when available.
- Current-location nearest-address behavior keeps priority when GPS resolution is already active.
- Added Bootstrap icons:
  - Edit: `bi-pencil`
  - Set default: `bi-star`
  - Delete: `bi-trash3`
- Reordered React PromptPay locked DOM to match Laravel:
  QR -> amount -> account name -> lock summary/actions -> payment slip.
- No Firebase schema, Functions, Rules, Lalamove, order, or payment business logic changed.

Verification before deploy:
- Delivery parity browser test: **3/3 PASS**.
- Tests also verify action icons remain inside button bounds.
- PromptPay test verifies both DOM order and vertical visual order.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React callable contract: 59 references / 0 missing exports.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.07.462` / `/react/assets/index-BDGLjQ-X.js`.
- `git diff --check` PASS.
- No backend/Rules/schema changes.

Deploy state:
- Implementation commit `0e5e4c5c` — `fix: align delivery address and payment parity` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle is `/react/assets/index-BDGLjQ-X.js`.
- Production `npm run test:delivery-parity-browser`: **3/3 PASS** against the live Hosting origin.
- Deployment scope was Hosting only.
- No Functions, Firestore Rules, Storage Rules, schema changes, or merge to `main`.


---

## 2026-10-07 — Delivery header/slip parity TDD repair (Build 2026.10.07.463)

Request:
- Payment-slip drop-zone icon still did not match Laravel after prior rounds.
- Delivery header layout must match Laravel while preserving current PENGUIN branding.
- Continue test-first workflow.

Test-first evidence:
- Extended `tests/react-parity/delivery-parity.spec.mjs` before changing runtime code.
- New tests initially failed against Build 2026.10.07.462:
  - header had only 2 direct children: `brand` + `header-actions`, instead of Laravel's `brand -> badge -> locale` sibling order;
  - payment-slip icon content was empty because React rendered `bi-image` instead of Laravel's literal `+`.

Laravel baseline:
- `resources/views/migrated/delivery.blade.php` renders header content as brand then badge; shared layout appends locale switcher after the yielded header.
- Laravel payment slip markup uses `<div class="payment-slip-icon">+</div>`.

Implementation:
- `PublicStorefrontHeader` now renders direct siblings in Laravel order:
  `brand -> badge -> LocaleSwitcher`.
- PENGUIN branding is preserved; FOD/LUKKAJA branding was not restored.
- React payment-slip drop zone now renders literal `+` instead of `bi-image`.

Verification before deploy:
- Delivery parity browser test: **4/4 PASS**.
- Header test verifies 3 direct children and geometry: badge stays beside brand, locale remains to the right.
- Payment-slip test verifies exact `+` text and no nested image icon.
- Existing default-address, saved-address action-icon, and PromptPay layout tests remain PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.07.463` / `/react/assets/index-DT-Uipf5.js`.
- `git diff --check` PASS.

Deploy state:
- Implementation commit `bba453cc` — `fix: align delivery header and slip icon parity` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle is `/react/assets/index-DT-Uipf5.js`.
- Production `npm run test:delivery-parity-browser`: **4/4 PASS**.
- Header direct-child order, badge placement, locale placement, payment-slip `+`, default-address selection, address-action icons, and PromptPay visual order all pass on live Production.
- Deployment scope was Hosting only.
- No Functions, Firestore Rules, Storage Rules, schema change, or merge to `main`.


---

## 2026-10-07 — Delivery Success full Laravel parity repair (Build 2026.10.07.464)

Request:
- User reported Delivery appeared broadly broken after React cutover and supplied a side-by-side Delivery Success comparison.
- Re-audit the Delivery flow more carefully instead of patching isolated visuals.
- Continue test-first workflow.

Test-first evidence:
- Added `tests/react-parity/delivery-success-parity.spec.mjs` before changing Success runtime code.
- Initial Production run against Build 2026.10.07.463 using the user's live order ID failed **4/4**:
  1. missing Laravel workspace body/theme classes,
  2. missing tracking card/timeline,
  3. toolbar/receipt hooks did not match Laravel,
  4. download action did not produce a PNG download.
- Existing Delivery checkout parity suite remained the regression guard for the main Delivery page.

Laravel MASTER baseline:
- `resources/views/migrated/delivery__success.blade.php`
- `public/assets/js/delivery-success.js`
- `public/assets/css/delivery-success-tracking.css`
- `public/assets/css/order-delivery-workspace-theme.css`
- `public/assets/css/receipt-layout.css`

Implementation:
- Restored Success body classes: `order-delivery-workspace od-receipt-page delivery-success-page`.
- Restored Laravel stylesheet stack including `order-delivery-workspace-theme.css`.
- Extended `PublicStorefrontHeader` with an optional direct action sibling so Success can render Laravel order:
  brand -> `#orderAgainLink` -> locale switcher.
- Restored the full tracking card:
  - status message and badge,
  - six-step timeline,
  - current/done state mapping,
  - last-updated timestamp,
  - conditional Lalamove customer tracking link.
- Restored receipt-page order:
  tracking card -> receipt toolbar -> receipt.
- Restored toolbar hooks `#saveImageButton` and `#verifyLatestLink`.
- Restored Laravel receipt IDs and item markup, including `.receipt-item-line`, item text, quantity, and note.
- Receipt now uses `settings.shopName` like Laravel MASTER.
- Receipt date now uses Gregorian Bangkok `dd/mm/yyyy HH:mm`, matching Laravel instead of Thai Buddhist year/seconds.
- Receipt subtotal follows Laravel stored subtotal/fallback semantics.
- Verification URL restored to Laravel-compatible `/verify/?tenant=...&order=...`.
- Download action now creates a PNG using the same html2canvas 1.4.1 CDN dependency as Laravel and downloads `delivery-order-<ORDER>.png`; it no longer opens a print window.
- React/Firebase order loading and live Firestore watch remain intact.

Verification before deploy:
- Delivery Success parity browser suite: **4/4 PASS** on Hosting emulator using the user's live order.
- Existing Delivery checkout parity browser suite: **4/4 PASS**.
- Success browser checks cover body/theme, header structure, 6-step tracking, toolbar/receipt order, receipt hooks/items, and real PNG download event.
- Candidate visual capture confirmed:
  - tracking card above toolbar,
  - centered receipt,
  - Gregorian date `07/10/2026 21:56`,
  - Laravel-style receipt width/spacing.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS after updating the foundation contract for the restored Success structure.
- React callable contract: 59 references / 0 missing exports.
- `npm run build:react` PASS.
- Generated React build contract PASS for Build `2026.10.07.464` / `/react/assets/index-Jh-9nXIG.js`.
- `git diff --check` PASS.
- No Functions, Firestore Rules, Storage Rules, schema changes, or merge to `main`.

Deploy state:
- Implementation commit `0414066d` — `fix: restore delivery success laravel parity` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle is `/react/assets/index-Jh-9nXIG.js`.
- Production Delivery checkout parity suite: **4/4 PASS**.
- Production Delivery Success parity suite using the user's live order: **4/4 PASS**.
- Production Success targeted audit confirmed:
  - PENGUIN app icon is present in the header,
  - body class is `order-delivery-workspace od-receipt-page delivery-success-page`,
  - header order is `brand -> orderAgainLink -> locale`,
  - tracking card, receipt toolbar, and receipt are present,
  - receipt date is `07/10/2026 21:56`,
  - no page errors or relevant HTTP errors.
- Deployment scope was Hosting only.
- No Functions, Firestore Rules, Storage Rules, schema changes, or merge to `main`.


---

## 2026-10-07 — Global visible-button icon/spacing policy + Delivery Success repair (Build 2026.10.07.465)

Request:
- Make button styling a permanent project rule because text-only/too-tight buttons kept reappearing.
- Required policy:
  - every user-visible action button/button-like link has an icon,
  - icon has visible spacing before the label,
  - buttons/action groups keep spacing from adjacent actions and surrounding sections.
- Apply the rule to the supplied Delivery/Delivery Success screenshots.

Test-first evidence:
- Extended `tests/react-parity/delivery-success-parity.spec.mjs` before changing runtime code.
- Initial test against Production Build 2026.10.07.464 failed because `#orderAgainLink` had no `i.app-icon`.
- Production DOM audit also found:
  - `#orderAgainLink`, `#saveImageButton`, and `#verifyLatestLink` were text-only,
  - Brand -> `สั่งเพิ่ม` spacing was exactly 0px,
  - existing toolbar button gap was 8px,
  - tracking -> toolbar spacing was 16px.

Permanent project rule:
- Added the rule to `README.md`, `STRUCTURE.md`, and `docs/PARITY_VERIFICATION_PLAN.md`.
- Standard minimums:
  - icon -> label: >= 7px,
  - adjacent actions: >= 8px,
  - action group -> section before/after: >= 12px.
- Text action buttons are not allowed.
- Intentional icon-only controls still require a visible icon and accessible label.
- Branded sign-in controls may use their branded image as the icon.
- `tools/react-foundation-contract.mjs` now guards the documented policy and Delivery Success action icon/spacing contract.

Implementation:
- Delivery Success `สั่งเพิ่ม`: `bi-plus-circle app-icon` + label span.
- `ดาวน์โหลดใบสั่งซื้อ`: `bi-download app-icon` + label span.
- `ดูยอดล่าสุด`: `bi-eye app-icon` + label span.
- Conditional `ติดตามคนขับ`: `bi-truck app-icon` + label span.
- Delivery Success header gap set to 12px and locale remains pushed to the far right.
- Receipt toolbar gap increased to 12px and bottom separation to 16px.
- Shared `icons.css` continues to provide the canonical 7px icon/text gap.

Verification before deploy:
- Delivery Success parity suite: **5/5 PASS** on Hosting emulator.
- Existing Delivery checkout parity suite: **4/4 PASS**.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- Generated build contract PASS for Build `2026.10.07.465` / `/react/assets/index-DAOfBKzq.js`.
- `git diff --check` PASS.
- Candidate measured geometry:
  - `สั่งเพิ่ม`: icon gap 7px, icon fully inside button,
  - `ดาวน์โหลดใบสั่งซื้อ`: icon gap 7px, icon fully inside button,
  - `ดูยอดล่าสุด`: icon gap 7px, icon fully inside button,
  - Brand -> `สั่งเพิ่ม`: 12px,
  - `สั่งเพิ่ม` -> locale: > 8px,
  - toolbar button gap: 12px,
  - tracking -> toolbar: 16px,
  - toolbar bottom spacing: 16px.
- No Functions, Firestore Rules, Storage Rules, or schema changes.

Deploy state:
- Implementation commit `cdd11f27` — `fix: enforce visible button icon spacing policy` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle is `/react/assets/index-DAOfBKzq.js`.
- Production Delivery Success parity suite: **5/5 PASS** using the user's live order.
- Production Delivery checkout parity suite: **4/4 PASS**.
- Targeted Production total: **9/9 PASS**.
- The Production button-policy test verifies:
  - semantic icons exist on `สั่งเพิ่ม`, `ดาวน์โหลดใบสั่งซื้อ`, and `ดูยอดล่าสุด`,
  - icon -> label gap is >= 7px,
  - Brand -> `สั่งเพิ่ม` gap is >= 8px,
  - toolbar adjacent-button gap is >= 8px,
  - tracking/action-group surrounding spacing is >= 12px.
- Deployment scope was Hosting only.
- No Functions, Firestore Rules, Storage Rules, schema changes, or merge to `main`.


---

## 2026-10-07 — Global button/badge spacing + icon Y-center policy (Build 2026.10.07.466)

Request:
- Extend the permanent UI rules:
  - same-row `element -> button -> element` must keep spacing on both sides,
  - same-row `element -> badge -> element` must keep spacing on both sides,
  - button icons must always be vertically centered on the button Y axis.

Permanent policy:
- Updated `README.md`, `STRUCTURE.md`, and `docs/PARITY_VERIFICATION_PLAN.md`.
- Standard minimums:
  - icon -> label: >= 7px,
  - same-row element -> button -> element: >= 8px clear space on both sides,
  - same-row element -> badge -> element: >= 8px clear space on both sides,
  - adjacent actions: >= 8px,
  - action group -> surrounding section: >= 12px,
  - icon Y-center deviation from button center: <= 1px.
- Intentional icon-only controls still require a visible, Y-centered icon and accessible label.
- `tools/react-foundation-contract.mjs` now guards the expanded policy and the shared app-header gap.

Test-first evidence:
- Production Build 2026.10.07.465 was measured before changing runtime CSS.
- Delivery header measured `Brand -> badge = 0px`, so the new badge-spacing rule correctly failed.
- The new Delivery header browser assertion failed with expected >=8px / actual 0px.
- Existing visible button icons measured Y-center deviation 0px and therefore already satisfied the new Y-axis rule.

Implementation:
- Shared `.app-header` now has a 12px flex gap.
- Existing locale `margin-left:auto` remains intact, so language controls stay at the far edge while preserving the minimum direct-sibling gap.
- Delivery header now satisfies `brand -> badge -> locale` spacing without changing the PENGUIN branding order.
- Delivery saved-address action tests now verify icon containment and <=1px Y-center deviation.
- Delivery Success visible-action policy test now verifies <=1px icon Y-center deviation in addition to icon presence, icon/label gap, adjacent action spacing, and perimeter spacing.

Verification before deploy:
- `npm run build:react` PASS.
- Generated build contract PASS for Build `2026.10.07.466` / `/react/assets/index-B2znYP2F.js`.
- Delivery parity browser suite: **4/4 PASS**.
- Delivery Success parity browser suite: **5/5 PASS**.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `git diff --check` PASS.
- Candidate geometry:
  - Delivery Brand -> badge = 12px,
  - Delivery badge -> locale > 8px,
  - `เพิ่มที่อยู่` icon Y-center deviation = 0px,
  - `ตรวจสอบและชำระเงิน` icon Y-center deviation = 0px,
  - `สั่งเพิ่ม` icon Y-center deviation = 0px,
  - `ดาวน์โหลดใบสั่งซื้อ` icon Y-center deviation = 0px,
  - `ดูยอดล่าสุด` icon Y-center deviation = 0px.
- No Functions, Firestore Rules, Storage Rules, or schema changes.

Deploy state:
- Implementation commit `3a57e6cd` — `fix: enforce button badge spacing and icon centering` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle is `/react/assets/index-B2znYP2F.js`.
- Production Delivery parity suite: **4/4 PASS**.
- Production Delivery Success parity suite: **5/5 PASS**.
- Targeted Production total: **9/9 PASS**.
- Production geometry:
  - Delivery Brand -> badge = 12px,
  - Delivery badge -> locale > 8px,
  - `เพิ่มที่อยู่` icon Y-center deviation = 0px,
  - `ตรวจสอบและชำระเงิน` icon Y-center deviation = 0px,
  - `สั่งเพิ่ม` icon Y-center deviation = 0px,
  - `ดาวน์โหลดใบสั่งซื้อ` icon Y-center deviation = 0px,
  - `ดูยอดล่าสุด` icon Y-center deviation = 0px.
- Deployment scope was Hosting only.
- No Functions, Firestore Rules, Storage Rules, schema changes, or merge to `main`.


---

## 2026-10-07 — Delivery mobile badge alignment + conditional Favorites (Build 2026.10.07.467)

Request:
- Re-check Delivery badge against the permanent badge spacing rule.
- On Mobile, keep the Delivery header badge visibly beside the left-side brand instead of letting the brand flex box push it toward the center/right.
- Show the `เมนูโปรด` category only when the current guest or signed-in customer actually has persisted favorite menu IDs:
  - guest: localStorage,
  - signed-in customer: Firebase customer profile.

Test-first evidence:
- Added two browser tests before runtime changes.
- Production Build 2026.10.07.466 initially failed both:
  - mobile brand box had 170.34px of unused trailing width, pushing the badge away from the visible PENGUIN content;
  - `__favorites__` category existed even with zero persisted favorites.
- The favorites test covers:
  - hidden before first favorite,
  - visible only after persistence succeeds,
  - survives reload from localStorage,
  - disappears after removing the final favorite.

Implementation:
- Mobile Delivery header overrides the shared responsive brand flex to `flex: 0 0 auto` with selector specificity high enough to beat the generic mobile rule.
- Mobile Delivery badge is also non-growing/non-shrinking.
- `extraCategory` is now supplied only while `favoriteIds.size > 0`.
- If the final favorite is removed while the Favorites tab is active, the page automatically returns to `ทั้งหมด`.
- Favorite UI state is now committed only after `saveDeliveryCustomerFavorites(...)` succeeds:
  - guest writes to `food_order_guest_menu_favorites:<tenant>` localStorage,
  - signed-in customer writes `favoriteMenuIds` to the tenant customer profile in Firestore.
- Existing customer-favorite loading still merges guest favorites into the signed-in customer's Firebase profile where applicable.

Verification before deploy:
- `npm run build:react` PASS.
- Generated build contract PASS for Build `2026.10.07.467` / `/react/assets/index-vYwHTtyY.js`.
- Delivery parity browser suite: **6/6 PASS**.
- Delivery Success parity browser suite: **5/5 PASS**.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- `git diff --check` PASS.
- Candidate Mobile 440px geometry:
  - brand unused trailing width = 0px,
  - visible brand content -> badge = 10px,
  - badge -> language > 8px,
  - badge x-position = 131.67px while language remains at the right edge.
- Candidate with a clean guest context: Favorites category hidden.
- No Functions, Firestore Rules, Storage Rules, or schema changes.

Deploy state:
- Commit/push and Hosting-only deploy pending at this checkpoint.

### 2026-10-07 — Build 2026.10.07.467 deployed
- Implementation commit: `682113e9 fix: align mobile delivery badge and favorites visibility`.
- Firebase Hosting `foodapp` deployed successfully.
- Production bundle: `/react/assets/index-vYwHTtyY.js`.
- Production Delivery parity: **6/6 PASS**.
- Production Delivery Success parity: **5/5 PASS**.
- Targeted Production total: **11/11 PASS**.
- Mobile Delivery badge stays immediately after visible PENGUIN brand content; locale stays at the far right.
- Clean guest context hides Favorites; a successfully persisted favorite reveals it; reload restores it; removing the final favorite hides it again.
- Guest favorites remain localStorage-backed; signed-in favorites remain Firestore `favoriteMenuIds`-backed.
- Hosting-only deploy; no Functions/Rules/schema changes and no merge to `main`.


---

## 2026-10-08 — Global initial loading + Verify title + Kitchen Lalamove lock parity (Build 2026.10.08.468)

Request:
- Add a permanent system rule: every page must show a full-screen initial loading state before required data is ready.
- Loading must be centered on both X/Y axes with spinner + progress and localized text:
  - `กำลังโหลดข้อมูล...`
  - `กรุณารอสักครู่ ...`
- Do not reveal partially loaded page content; remove initial loading completely when ready.
- Fix raw `verify.header.title` visible on Verify.
- Match Laravel Kitchen behavior: once Cashier has successfully placed a Lalamove dispatch, Kitchen item/amount editing must lock.

Test-first evidence:
- Foundation contract initially failed at `DeliveryPage.jsx` because it had no full-screen PageReadyOverlay.
- Kitchen lock behavior test initially failed because no shared lock utility existed.
- Verify source showed `t("verify.header.title")` while the translation schema stores `verify.header` as a string.
- Static audit found 14 React pages/route entries without the shared initial full-screen overlay; after repair the audit reports **0**.

Implementation:
- Standardized initial readiness on the shared `PageReadyOverlay` across Delivery, Delivery Success, Takeaway, Verify, Public Order, Legal, POS Backup/Forbidden/Users, Waiting Queue Customer/Display, Register, public missing-route, and storefront compatibility redirect flow.
- Overlay remains full-screen/fixed, centered X/Y and now includes:
  - spinner,
  - indeterminate progress bar,
  - shared localized loading/wait copy.
- Thai shared text is now exactly `กำลังโหลดข้อมูล...` / `กรุณารอสักครู่ ...`; EN/MY/LO/KM equivalents were updated normally.
- Initial page-specific inline loading blocks were removed where the shared overlay now owns initial readiness.
- Redirect compatibility entry now shows the overlay while navigation is pending.
- Verify header now uses `t("verify.header")`; raw `verify.header.title` is no longer present.
- Added `react-app/src/utils/kitchenOrderLock.js` as the Kitchen Lalamove lock source of truth:
  - active dispatch evidence locks editing,
  - `PICKED_UP` remains locked,
  - legacy/partially migrated orders are recognized from Lalamove dispatch evidence even if `deliveryProvider` is missing,
  - CANCELED/CANCELLED/REJECTED/EXPIRED releases the dispatch-specific lock when the operational order itself is still active,
  - served/paid/completed/cancelled operational states remain locked.
- Added `test:kitchen-lalamove-lock` to the standard `test:react-parity` chain.
- Added permanent loading/readiness rules to README, STRUCTURE, and PARITY_VERIFICATION_PLAN; foundation contract guards the rule and visual contract.

Candidate verification:
- `npm run build:react` PASS.
- Generated build contract PASS: `2026.10.08.468` / `/react/assets/index-CLcSUg_u.js`.
- Operational orders contract PASS.
- React parity/foundation/migration/P0/callable/tenant/UI-layer contracts PASS.
- Kitchen Lalamove lock behavior: **4/4 PASS**.
- Delivery parity browser suite: **6/6 PASS**.
- Delivery Success parity browser suite: **5/5 PASS**.
- Verify browser check using order `04afe611-95d9-4755-a1e8-52752f4c0101`:
  - full-screen overlay visible while Firestore is intentionally delayed,
  - viewport coverage 1440x900,
  - X center deviation 0px / Y center deviation about 0.01px,
  - spinner present,
  - indeterminate progress present,
  - approved Thai loading/wait text present,
  - after data is ready: overlay absent, inline Verify loading absent,
  - header reads `ตรวจสอบยอดล่าสุด`,
  - raw `verify.header.title` absent.
- `git diff --check` PASS.
- No Functions, Firestore Rules, Storage Rules, or schema changes.

Deploy state:
- Commit/push and Hosting-only deploy pending at this checkpoint.


### 2026-10-08 — Build 2026.10.08.468 deployed
- Implementation commit `12752eac` — `fix: enforce global loading and kitchen dispatch lock` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle: `/react/assets/index-CLcSUg_u.js`.
- Production P0 browser smoke: **52/52 PASS**.
- Production Verify check with order `04afe611-95d9-4755-a1e8-52752f4c0101` confirms:
  - full-screen 1440x900 overlay during delayed initial Firestore load,
  - X center deviation 0px / Y about 0.01px,
  - spinner + indeterminate progress,
  - `กำลังโหลดข้อมูล...` / `กรุณารอสักครู่ ...`,
  - translated header `ตรวจสอบยอดล่าสุด`,
  - no raw `verify.header.title`,
  - no full-screen or inline initial loading remains once ready.
- Kitchen Lalamove lock remains covered by **4/4 PASS** in the standard React parity suite.
- Deployment scope was Hosting only.
- No Functions, Firestore Rules, Storage Rules, schema changes, or merge to `main`.


---

## 2026-10-08 — Delivery Favorites category heart label (Build 2026.10.08.469)

Request:
- Add a visible heart in front of the Delivery Favorites category label so it reads `❤️ เมนูโปรด`.

Test-first:
- Added a Delivery parity assertion requiring the Favorites tab text to match `❤️ เมนูโปรด`.
- The focused Production test failed first as expected because Build .468 still rendered only `เมนูโปรด`.

Implementation:
- Updated Delivery's `PublicMenuCatalog` `extraLabel` to prefix the localized Favorites text with `❤️`.
- Favorites behavior is otherwise unchanged:
  - the Favorites category is only rendered when `favoriteIds.size > 0`,
  - guest persistence remains localStorage-backed,
  - signed-in persistence remains Firebase-backed,
  - removing the final favorite still hides the Favorites category.

Candidate verification:
- React Build: `2026.10.08.469`.
- Candidate bundle: `/react/assets/index-B5d0PDpx.js`.
- `npm run build:react` PASS.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- Delivery browser parity on Hosting emulator: **6/6 PASS** including `❤️ เมนูโปรด` regression coverage.
- `git diff --check` PASS.
- No Functions, Firestore Rules, Storage Rules, or schema changes.

Deploy state:
- Commit/push and Hosting-only deployment pending at this checkpoint.


### 2026-10-08 — Build 2026.10.08.469 deployed
- Implementation commit `f3a962f4` — `fix: add heart to delivery favorites category` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle: `/react/assets/index-B5d0PDpx.js`.
- Focused Production Delivery Favorites regression test: **1/1 PASS**.
- Production now renders the Favorites category as `❤️ เมนูโปรด` after a favorite exists, and removes the category again when the last favorite is removed.
- Deployment scope was Hosting only.
- No Functions, Firestore Rules, Storage Rules, schema changes, or merge to `main`.

---

## 2026-10-08 — Delivery Favorites Laravel heart-icon parity (Build 2026.10.08.470)

Request:
- Replace the previously added emoji before `เมนูโปรด` with the exact visual treatment from Laravel MASTER.

Laravel MASTER comparison:
- `public/assets/css/delivery-favorites.css` uses a CSS pseudo-element, not an emoji in the label:
  - `content:"♥"`
  - `color:#e11d48`
  - `margin-right:5px`
  - Favorites tab `font-weight:800`.
- React already carried the Laravel CSS file, but its selector targeted localized category values while React uses the stable internal category id `__favorites__`, so the Laravel rule never matched.

Test-first:
- Changed the Delivery parity assertion to require plain localized text `เมนูโปรด` plus the Laravel `::before` styling.
- Production Build .469 failed first as expected because it rendered `❤️ เมนูโปรด`.
- Candidate Build .470 focused browser test passes 1/1 and verifies:
  - text is exactly `เมนูโปรด`,
  - `::before` content is `♥`,
  - color is rgb(225, 29, 72) / #e11d48,
  - right margin is 5px,
  - font weight is at least 800.

Implementation:
- Removed the emoji prefix from DeliveryPage's `extraLabel`.
- Updated `delivery-favorites.css` to target `data-category="__favorites__"`, preserving the exact Laravel styling.
- Favorites persistence/conditional visibility behavior is unchanged.

Verification:
- `npm run build:react` PASS.
- Generated build contract PASS: `2026.10.08.470` / `/react/assets/index-DXebLmjs.js`.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- Focused candidate Delivery Favorites browser test: **1/1 PASS**.
- `git diff --check` PASS.
- No Functions, Firestore Rules, Storage Rules, or schema changes.

### 2026-10-08 — Build 2026.10.08.470 deployed
- Implementation commit deployed to Firebase Hosting `foodapp`.
- Production bundle: `/react/assets/index-DXebLmjs.js`.
- Focused Production Favorites Laravel-icon regression: **1/1 PASS**.
- Production tab now keeps visible text `เมนูโปรด` and renders the red Laravel-style `♥` from CSS `::before`; no emoji is present in the label.
- Hosting-only deployment; no Functions/Rules/schema changes and no merge to `main`.


---

## 2026-10-08 — Modern organized Admin store/payment settings workspace (Build 2026.10.08.471)

Request:
- Redesign the expanded `ข้อมูลร้านและการรับชำระ` section because it had grown too long and mixed many unrelated settings.
- Make the workspace more modern, easier to scan, and hide settings that are not currently needed.
- Preserve all existing data fields, save behavior, business rules, and Firebase schema.

Analysis:
- The previous single form exposed store identity, map/location, PromptPay, bank account, Lalamove API/credentials/wallet, delivery provider, promotions, delivery fee tiers, and the save action in one continuous vertical page.
- This caused the map and advanced integrations to consume significant space even when the user only wanted to update a basic store field.
- The redesign therefore uses progressive disclosure instead of deleting settings.

Test-first:
- Added `tests/react-parity/admin-store-settings-layout.spec.mjs` before the runtime redesign.
- Initial result: **0/4 PASS** as expected because the modern grouping/status workspace did not exist.
- The test now guards:
  - seven named disclosure groups,
  - Store Basics open by default,
  - contextual Lalamove credential/wallet visibility,
  - hiding store delivery fee details when Lalamove is selected,
  - top configuration-status dashboard,
  - responsive modern workspace CSS.
- Added `test:admin-store-layout` into the standard `test:react-parity` chain.

Implementation:
- Added reusable `AdminSettingsGroup` for nested disclosure panels with semantic icon, status, chevron and accessible `aria-expanded`.
- Added a compact four-card status dashboard at the top:
  - Store — actual store name,
  - Location — configured / not configured,
  - Payments — configured payment-method count,
  - Delivery — store delivery / Lalamove.
- Reorganized the form into:
  1. `storeBasicsGroup` — store name, phone, address; **open by default**.
  2. `storeLocationGroup` — map/current location; collapsed by default so the map does not initialize until needed.
  3. `storePaymentGroup` — PromptPay and bank account cards; collapsed by default.
  4. `storeDeliveryGroup` — delivery provider and max distance.
  5. `storeLalamoveGroup` — account mode/integration details.
  6. `storePromotionGroup` — Delivery promotion settings.
  7. `storeFeeGroup` — store-controlled delivery fee tiers.
- Lalamove progressive disclosure:
  - tenant Environment/API credentials render only in Tenant Partner mode,
  - PENGUIN Wallet renders only in central-account mode,
  - store delivery-fee tiers are hidden while Lalamove is the selected provider because provider pricing is calculated externally.
- Promotion and fee editors gained embedded rendering to avoid duplicate nested card headings.
- The existing Save Store button remains the single save action and is visually sticky at the bottom of the workspace.
- Added responsive layout:
  - four status cards on desktop,
  - two columns at medium width,
  - one column on compact mobile,
  - payment methods stack on mobile,
  - disclosure status/chevron remain aligned without crowding.
- Added normal translations for TH/EN/MY/LO/KM under `admin.store_workspace`.
- No settings keys, document paths, IDs, save payloads, or schemas were renamed.

Candidate verification:
- React Build: `2026.10.08.471`.
- Generated build contract: PASS on `/react/assets/index-CZozpByB.js`.
- Admin Store Layout: **4/4 PASS**.
- `npm run test:operational`: PASS.
- `npm run test:react-parity`: PASS.
- React migration coverage: 53 routes / 52 React shells / 0 pending shell sync.
- React callable contract: 59 references / 0 missing exports.
- Tenant access and UI layer contracts: PASS.
- `git diff --check`: PASS.
- No Functions, Firestore Rules, Storage Rules, or schema changes.

Deploy state:
- Commit/push and Hosting-only deployment pending at this checkpoint.


### 2026-10-08 — Build 2026.10.08.471 deployed
- Implementation commit `af591341` — `feat: reorganize admin store settings workspace` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle: `/react/assets/index-CZozpByB.js`.
- Production serves `/react/parity/css/admin-store-settings-workspace.css` successfully (HTTP 200).
- Production P0 browser smoke: **52/52 PASS**.
- The Admin store/payment redesign remains UI-only:
  - same store/payment/delivery field IDs,
  - same save payload and verification,
  - same Firebase data paths,
  - no Functions/Rules/schema changes.
- Hosting-only deployment; no merge to `main`.


---

## 2026-10-08 — Strict initial readiness + real-progress-only loading (Build 2026.10.08.472)

Request:
- Some pages briefly showed the full-screen loader, removed it too early, then continued loading page components/data inside the visible page.
- Remove the bottom fake/indeterminate progress bar.
- Progress may be shown only when a route has a measurable real percent; otherwise show spinner + loading/wait text only.

Root cause:
- Several routes gated PageReadyOverlay only on auth/tenant/styles while their own first data fetch was still pending.
- 24 routes also passed hard-coded progress values such as 68/76/82/90/92, even though those numbers were not based on measurable work.
- The overlay itself rendered an indeterminate animated progress bar regardless of real progress.

Test-first:
- Added `tests/react-parity/global-initial-readiness.spec.mjs`.
- Before runtime fixes: **0/4 PASS**.
- It now permanently enforces:
  - no indeterminate/fake progress markup or animation,
  - no hard-coded numeric `progress={...}` props in route overlays,
  - optional real `progressPercent` must expose a true 0–100 progressbar + visible percent,
  - known first-load pages must keep PageReadyOverlay until `initialReady`.
- Added `test:global-initial-readiness` into the standard `test:react-parity` chain.

Initial-readiness repairs:
- Added first-load-only readiness gates without changing later refresh/action loading behavior to:
  - Admin,
  - Admin QR,
  - Platform Owners,
  - Platform Pricing,
  - POS Catalog,
  - Revenue Share Report,
  - Platform Contact,
  - Platform Control Center,
  - SaaS Setup.
- Revenue Share now waits for initial access, history and first report readiness before revealing the page.
- Platform Control Center waits for Branding, Google APIs, Slip verification, Lalamove and the first admin-notification summary.
- Action/refresh busy states after the page has opened remain component-local and do not force the page back into full-screen initial loading.

Real-progress-only overlay:
- Removed all 24 hard-coded fake progress props.
- Removed the indeterminate progress bar and animation.
- Normal initial loading now shows only:
  - centered spinner,
  - `กำลังโหลดข้อมูล...`,
  - `กรุณารอสักครู่ ...`.
- `PageReadyOverlay` now accepts optional `progressPercent`.
- A progress bar is rendered only when `progressPercent` is a finite measurable value; it displays the actual rounded percentage.
- Permanent README / STRUCTURE / PARITY_VERIFICATION_PLAN / foundation contracts were updated to forbid fake/estimated/indeterminate progress.

Candidate verification:
- React Build: `2026.10.08.472`.
- Generated build contract: PASS on `/react/assets/index-Bvkrur-l.js`.
- `npm run test:operational`: PASS.
- `npm run test:react-parity`: PASS.
- Global Initial Readiness: **4/4 PASS**.
- React migration coverage: 53 routes / 52 React shells / 0 pending.
- Callable contract: 59 references / 0 missing Functions exports.
- Tenant access + UI layer contracts: PASS.
- Hosting-emulator browser check with intentionally delayed Firestore:
  - full-screen overlay remains visible during initial fetch,
  - spinner present,
  - approved Thai loading/wait text present,
  - progress bars = 0,
  - fake indeterminate progress = 0,
  - after readiness: overlay absent, Verify inline loading absent, no loading text remains.
- No Functions, Firestore Rules, Storage Rules or schema changes.

Deploy state:
- Commit/push and Hosting-only deployment pending at this checkpoint.


### 2026-10-08 — Build 2026.10.08.472 deployed
- Implementation commit `115fdf45` — `fix: enforce strict initial readiness and real progress` pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `foodapp` deployed successfully to `https://penguin-food.web.app`.
- Production bundle: `/react/assets/index-Bvkrur-l.js`.
- Production P0 browser smoke: **52/52 PASS**.
- Production delayed-Firestore loading check confirms:
  - spinner present,
  - `กำลังโหลดข้อมูล...` / `กรุณารอสักครู่ ...`,
  - progress bars = **0** when no measurable progress exists,
  - fake/indeterminate progress = **0**,
  - after readiness: full-screen overlay absent,
  - Verify inline loading absent,
  - visible initial-loading text absent.
- Global Initial Readiness regression remains **4/4 PASS** in the standard React parity suite.
- Deployment scope was Hosting only.
- No Functions, Firestore Rules, Storage Rules, schema changes, or merge to `main`.

---

## 2026-10-08 — Public signup business model + scoped revenue share (Build 2026.10.08.473)

Request:
- Extend public registration so the customer chooses business type first: Restaurant / Cafe, Retail / convenience store, or both.
- Support Premium subscription or sales revenue share.
- Premium subscription keeps 590 THB/month, normal annual value 7,080 THB, annual offer 5,900 THB, first month free, with no revenue-share calculation.
- Restaurant/Cafe revenue share supports Delivery only (prepaid + COD), storefront only, or Delivery + storefront.
- Retail revenue share always includes every Retail POS sale.
- Send the selected signup configuration to Super Admin Store Management.

Implementation:
- Added functions/revenue-share-policy.js for shared billing/business/scope validation and revenue-share channel policy.
- Public signup now requires explicit billing/business selection and persists the immutable signup snapshot in signupBilling.
- Tenant activation creates only the selected business units: order_delivery, retail_pos, or both.
- Subscription signup preserves monthly/yearly planCode and the real 30-day trial end as subscriptionExpiresAt.
- Revenue-share signup activates directly in revenue-share mode, stores business/scope, starts at rate 0 until Super Admin sets the percentage, and does not create a subscription trial.
- Subscription initializer/backfill/scheduler skip revenue-share tenants and preserve plan/trial metadata.
- Repeat activation returns the original Subscription trial end.
- Revenue-share calculation now filters the percentage base by the selected policy:
  - Delivery only -> delivery orders only.
  - Storefront only -> every non-Delivery Restaurant order, including table, walkin, takeaway and legacy non-delivery orders.
  - Restaurant all -> all Restaurant orders.
  - Retail -> every valid Retail POS sale.
  - Both -> selected Restaurant scope plus all Retail POS sales.
- Lalamove delivery accounting remains independent from the percentage-base filter.
- Super Admin Store Management shows the original signup billing snapshot and can edit current revenue-share business/scope in the existing dialog.
- Register UI sequence is business first -> billing model -> monthly/yearly or Restaurant revenue-share scope.
- Shop-name fields are conditional by selected business.
- New copy is localized for Thai, English, Myanmar, Lao and Khmer.

Test-first / regression:
- Added tests/react-parity/signup-billing-revenue-share.spec.mjs and included it in test:react-parity.
- Initial feature contract was 0/7 PASS before implementation.
- Final focused suite: 11/11 PASS.
- Coverage includes explicit selection validation, business units, channel eligibility, business-first UI order, persistence, Super Admin controls, subscription lifecycle, idempotent activation and five-locale copy.

Candidate verification:
- React Version: 0.4.280.
- React Build: 2026.10.08.473.
- Generated bundle: /react/assets/index-f2OyyAlQ.js.
- Generated React build contract: PASS.
- npm run test:operational: PASS.
- npm run test:react-parity: PASS.
- Signup billing / revenue-share regression: 11/11 PASS.
- React migration coverage: 53 routes / 52 React shells / 0 pending shell sync.
- React callable contract: 59 references / 0 missing exports.
- Tenant access + UI layer contracts: PASS.
- Function syntax checks: PASS.
- git diff --check: PASS.
- No Firestore Rules, Storage Rules, database schema, collection name, document ID, or internal tenant ID changes.

Deploy scope:
- Hosting target foodapp required for Register / Super Admin UI and Build .473.
- Cloud Functions deployment required only for signup, revenue-share and subscription lifecycle Functions affected by this change.
- No Firestore Rules, Storage Rules, schema deployment, or merge to main.
- Commit/push and Production deploy pending at this checkpoint.


### 2026-10-08 — Build 2026.10.08.473 Production deploy verified
- Implementation commit: `28ea38ce` — `feat: add signup revenue share business policy`.
- Firebase Hosting Production bundle verified at `https://penguin-food.web.app`:
  - `/react/assets/index-f2OyyAlQ.js`.
- Cloud Functions Production revision verified from Firebase function metadata:
  - source hash `63e731d1f3d5f33180fb98d2f9cb0a5ba86f2c9e`,
  - new source generations on 2026-10-08,
  - the 12 deployed Functions in this release are:
    - `requestTrialTenantSignup`,
    - `activateTrialTenantSignup`,
    - `getPlatformRevenueShareSummary`,
    - `getTenantRevenueShareAccess`,
    - `getTenantRevenueShareSummary`,
    - `reconcileRevenueShare`,
    - `submitTenantRevenueSharePayment`,
    - `syncRevenueShareTenants`,
    - `updateTenantRevenueShare`,
    - `backfillTenantSubscriptions`,
    - `initializeTenantSubscription`,
    - `syncExpiredTenants`.
- Final verification:
  - `npm run test:operational`: PASS.
  - `npm run test:react-parity`: PASS.
  - Signup billing / revenue-share regression: **11/11 PASS**.
  - Production P0 browser smoke: **52/52 PASS**.
  - Production safe Register interaction: **PASS**, without submit/data writes:
    - business selection appears before billing selection,
    - Restaurant-only / Retail-only / Both show the correct shop-name fields,
    - Subscription shows monthly/yearly choices,
    - Restaurant Revenue Share shows 3 Restaurant scope choices,
    - Retail Revenue Share hides Restaurant scope and keeps the fixed Retail POS rule,
    - 590 / 7,080 / 5,900 pricing copy is present,
    - Production bundle matches Build .473.
- No Firestore Rules, Storage Rules, database schema, collection-name, document-ID, or internal tenant-ID changes.
- No merge to `main`.

---

## 2026-10-08 — Production P0 anonymous auth-redirect timing stabilization

Context:
- Continued verification after the full React frontend/runtime cutover while Production was already on React Build `2026.10.08.473`.
- Structural audit reconfirmed `public/assets/js`, `public/assets/css`, and `public/react/parity/js` are absent.
- React source contains zero references to legacy `/assets/js` or `/assets/css` page runtimes.
- React migration coverage remains 53 routes / 21 POS routes / 52 physical React shells / 0 pending shell sync.

Observed verification flake:
- Production P0 browser smoke initially passed 50/52.
- Anonymous auth-boundary checks for `/admin` and `/platform/contact` exceeded the previous fixed 5-second navigation ceiling.
- Direct anonymous timing verification showed:
  - `/admin` redirected to `/login?next=%2Fadmin` in about 2.24 seconds.
  - `/platform/contact` redirected to `/login?next=%2Fplatform%2Fcontact` in about 1.37 seconds.
  - While waiting, the page exposed only the full-screen loading/readiness state; no protected workspace content was visible.
  - Page errors were zero.

Change:
- Increased only the P0 anonymous auth redirect wait ceiling from 5 seconds to 10 seconds in `tests/react-parity/p0-smoke.spec.mjs`.
- Runtime auth logic, permissions, React pages, Firebase data, Functions, Rules, schema, and release identity were not changed.

Verification:
- Production P0 browser smoke against `https://penguin-food.web.app`: **52/52 PASS**.
- `npm run test:operational` PASS.
- `npm run test:react-parity` PASS.
- React migration coverage PASS: 53 routes / 21 POS routes / 52 React shells / 0 pending shell sync.
- `git diff --check` PASS.

Deploy state:
- Test-only stabilization; no Hosting, Functions, Firestore Rules, Storage Rules, or schema deploy is required.
- Production remains React `0.4.280` / Build `2026.10.08.473`.
- No merge to `main`.


## 2026-10-08 — Super Admin tenant Master business editor and signup card refresh (Build 2026.10.08.474)
- Added a separate Master business selector (Restaurant/Cafe, Retail, Both) to tenant Edit dialog; not the revenue-share selector.
- updateTenant validates business type server-side and synchronizes businessType/businessUnits for tenant and users without deleting stores, orders, sales or collections.
- Original signupBilling snapshot and revenueShareBusinessType/scope remain untouched.
- Signup information card presents current Master business separately from original billing/business/scope in a responsive layout.
- Deployment requires Hosting and updateTenant Function; no Rules/Storage/schema changes; no main merge.


### Build 2026.10.08.474 — Production deployment verified
- Commit pushed: 647e7bf2 (feature/react-firebase-port).
- npm run test:operational PASS; npm run test:react-parity PASS, including 12/12 signup policy tests.
- npm run build:react and generated build contract PASS (index-CfBFiHtu.js); git diff --check PASS.
- Firebase deploy succeeded: hosting:foodapp and functions:updateTenant only (project chat-45754).
- Production /admin/tenants HTML references index-CfBFiHtu.js; tenant-admin.css contains tenant-master-business-field.
- No authenticated live tenant update was performed. Existing signup snapshots and share settings remain unchanged.
- No merge into main. Older untracked generated bundle index-Dplusb-p.js retained per emptyOutDir:false safety rule.

\n## 2026-10-08 — Master-driven revenue share correction (Build 2026.10.08.475)
- Share dialog business type is read-only and sourced from tenant Master, not editable independently.
- Server updateTenantRevenueShare ignores supplied business type and derives it from tenant Master, retaining a legacy fallback.
- Restaurant/Cafe: selected delivery/storefront/both scope determines eligible restaurant orders; Retail POS never counts.
- Retail-only: no scope choice; all non-cancelled valid Retail POS sales eligible.
- Both: delivery-only excludes Retail POS; storefront-only includes Retail POS + non-delivery restaurant sales; all includes both channels.
- Preserved legacy signup history, Master editing, billing-cycle and Lalamove calculations.


### Build 2026.10.08.475 — Production checkpoint
- Commit 959d5a43 pushed to feature/react-firebase-port.
- Operational PASS, React parity PASS, revenue share regression 13/13 PASS, React Build/contract PASS, git diff --check PASS.
- Firebase Hosting and five Functions successfully deployed: updateTenantRevenueShare, getPlatformRevenueShareSummary, getTenantRevenueShareSummary, reconcileRevenueShare, syncRevenueShareTenants.
- Production /admin/tenants serves /react/assets/index-4BuXq3cq.js, matching Build 2026.10.08.475.
- No customer tenant records modified during verification; no main merge.
- Untracked old generated bundle index-Dplusb-p.js retained.


## 2026-10-08 — Master business tenant visibility (candidate, deployment blocked)
- Business requirement: Restaurant-only users see only restaurant capabilities; Retail-only see Retail POS capabilities; Both see both. Must guard underlying data access, not only cards.
- Candidate Build 2026.10.08.476: Home dashboard sections filtered using live tenant Master; App route guard checks master for /pos vs /admin, /cashier, /kitchen, /waiting-queue and redirects unauthorized paths.
- Automated operational/react parity and React build contract PASS.
- SECURITY BLOCKER: Firestore Rules currently allow tenantMember retail collections and role-based tenant restaurant data independent of Master; storefront/public and callable permissions still need comprehensive review.
- DO NOT deploy candidate or declare feature finished until server-side Rules/access checks are added and safely verified. Existing project policy limits deploy to Hosting unless Rules explicitly authorized.
- No customer data modified, no merge main, no reset or cleanup of old generated assets.


### 2026-10-08 — Master business access Rules implementation (Build 2026.10.08.476)
- Tenant Master businessType controls Home visibility and business dashboard route guards using live tenant context.
- Firestore Rules enforce Master across tenant-scoped Retail POS collections and Restaurant/Cafe menus/orders/tables/queues. Legacy tenant Master absence defaults both; Super Admin retains access.
- Shared takeaway counters retain Restaurant permissions independently of POS. Original records remain untouched.
- Master access regression 2/2 PASS, operational/react-parity PASS, Build .476 contract PASS, Rules compilation dry-run PASS.
- User explicitly authorized Firestore Rules deployment. Hosting plus Firestore Rules only.
- Shared config and callable authorization retain their existing mechanisms; authenticated end-to-end verification remains recommended.


### Build 2026.10.08.476 — Hosting + Firestore Rules Production checkpoint
- Implementation commit: 3ac480f5 on feature/react-firebase-port.
- Firebase CLI verified Firestore rules compilation, uploaded and released firestore.rules; Hosting target foodapp released successfully.
- Public /admin/tenants serves index-BOJWGx2k.js, matching Build 2026.10.08.476.
- Full React parity/operational tests PASS, Master business access regression 2/2 PASS.
- No data writes to customer tenants, no Functions/Storage deploy and no merge into main.
- Limit: authenticated tenant-by-tenant UI/data smoke and callable access review remain for more comprehensive assurance. Existing shared settings and callable access mechanisms were not changed.
- Untracked older generated bundle index-Dplusb-p.js preserved.


## 2026-10-08 — Compact full-width tenant signup information (Build 2026.10.08.477)
- Redesigned Super Admin tenant registration summary into a full-width horizontal layout: left Master business highlight; right adaptive signup details grid.
- Desktop shows compact horizontal cards, tablet stacks Master above details and mobile uses 2 columns / 1 narrow column.
- Data source and business logic unchanged: current Master is distinct from immutable original signupBilling snapshot. No Firestore/Functions/Rules/schema changes.
- npm run test:operational PASS, npm run test:react-parity PASS, npm run build:react and generated build contract PASS.
- Hosting-only deployment required; no main merge.


### Build 2026.10.08.477 — Production checkpoint
- Implementation commit 9b4c0432 pushed to feature/react-firebase-port.
- Firebase Hosting-only deploy succeeded at https://penguin-food.web.app; no Functions, Firestore Rules or Storage changes.
- Production served index-C0AOWSxk.js and updated compact signup CSS.
- No merge to main, no customer tenant mutations. Untracked old generated index-Dplusb-p.js retained.


## 2026-10-08 — Registration summary parent-grid spanning fix (Build 2026.10.08.478)
- User screenshot after .477 proved registration box still occupied only first parent grid column (approx 330px) and right side was blank.
- Corrected .tenant-store-card > .tenant-signup-billing with grid-column:1/-1 and stretch; existing inner horizontal responsive arrangement remains.
- Root cause was parent grid placement, not child width. No revenue-share or tenant Master logic changed.
- npm run test:operational, npm run test:react-parity, npm run build:react and generated build contract all PASS.
- Hosting-only deployment. Authenticated screenshot verification still requires browser login; production bundle/CSS verification after deploy.


## 2026-10-08 — Home atomic report readiness and POS overlay styling (Build 2026.10.08.479)
- Home owner/admin revenue share access starts as pending null and participates in the full-screen loading gate: central report no longer appears 3-5 seconds after Home already rendered.
- MasterBusinessGuard previously used bare unstyled Thai loading text; now uses same full-screen PageReadyOverlay for /pos and /pos/catalog while tenant context loads.
- Added matching green marker before Retail POS title via home-dashboard.css.
- Operational tests, full React parity and React Build contract PASS.
- Hosting-only release; no Firebase Functions/Rules changes; no main merge.


### Build 2026.10.08.479 — Production checkpoint
- Implementation 674ab9fa pushed to feature/react-firebase-port; Firebase Hosting deployment succeeded.
- Production root HTML references index-BVRccUB-.js; live home-dashboard.css includes Retail POS heading marker.
- No customer data edits or backend deployments. Authenticated visual smoke still pending; old untracked bundle index-Dplusb-p.js retained.


## 2026-10-08 — Admin category/menu drag-and-drop Auto-save (Build 2026.10.08.480)
- On /admin menu sort, changed both category/menu order button labels to บันทึก (Save).
- Sortable onEnd persists immediately on release for both category ordering and per-category menu ordering; skip no-op drags.
- Sequential pending-save queue stores the latest change if another drag completes before a prior save finishes. Prevents losing rapid reorders; toast on saved/failed.
- Manual Save buttons remain available; disabled while the respective save is in progress.
- Updated P0 action contract and added admin-menu-sort-autosave regression checks (4/4 pass).
- Operational PASS, React parity PASS, React build and generated artifact contract PASS. Hosting-only release; no main merge.


### Build 2026.10.08.480 — Production checkpoint
- Implementation commit 1b562128 pushed to feature/react-firebase-port.
- Firebase Hosting foodapp deployment succeeded; production /admin serves index-SQLfu11O.js (Build .480).
- No Functions/Rules/Storage changes, no tenant data mutated, no merge into main.
- Authenticated drag-and-drop browser smoke still to be verified; old generated index-Dplusb-p.js preserved.

## 2026-10-08 — Lalamove revoke button label (Build 2026.10.08.481)
- Super Admin /admin/tenants revoke button Thai label shortened to ยกเลิกสิทธิ์ Lalamove, English to Revoke Lalamove Access, preventing mobile overflow.
- Confirmation/dialog messages and approval logic unchanged. Hosting only; no main merge.


### Build 2026.10.08.481 — Production checkpoint
- Implementation commit 290a4405 pushed to feature/react-firebase-port.
- Firebase Hosting deployment succeeded. Production bundle index-CGeELT5g.js.
- All operational, parity and React build checks passed. No backend changes or main merge.

## 2026-10-08 — Lalamove approval button (Build 2026.10.08.482)
- Shortened Thai approval button to อนุมัติ Lalamove and English to Approve Lalamove; unchanged approval logic and confirmation.
- Hosting only, no merge main.


## 2026-10-08 — Delivery Slip2Go integration (WORK IN PROGRESS — NOT DEPLOYED)
- Confirmed scope: restaurant/cafe Delivery only; no Retail POS changes.
- Existing tenant Delivery checkout creates pending_verification orders directly and stores uploaded slips; existing kitchen watches active orders regardless of payment verification.
- Existing Slip2Go helper functions/slip-verification.js checks against platform central receiver; customer payment recipient is tenant-specific promptPayId/Name, so reusing as-is would misverify the destination.
- Existing notifyDeliveryOrderCreated alerts owner/cashier on creation. New flow must retain cashier alerts for COD and manual-review orders, only alert kitchen after payment admission.
- Staged react-app/src/data/deliveryKitchenGate.js with COD admitted, PromptPay held until paid, and a KitchenPage card filter. Node regression 2/2 PASS.
- SECURITY WORK REMAINING before deploying: trusted server verification using tenant-specific receiver, duplicate protection, trustworthy transition to paid, customer retry/COD error handling, manual cashier approval and release, payment status security and push/notification behavior, integration tests.
- DO NOT deploy this WIP Kitchen filter alone or merge main. No tenant orders or production data touched.


## 2026-10-08 — Delivery Slip2Go central payment verification (Build 2026.10.08.483)
- Scope restaurant/cafe Delivery only; retail-only Master excluded. COD bypasses Slip2Go, immediately enters kitchen.
- Added callable verifyDeliveryPaymentSlip: uploads stay in tenant payment-slips; server fetches image, verifies against central Slip2Go secret and merchant PromptPay phone/tax ID (receiver types 02001/02003), checks exact amount, duplicate reference and receiver.
- Validates customer cart line IDs/qty/prices against Firestore menu master before verification and signs amount, fee and sorted cart data in an inaccessible server-side proof document.
- Rejected duplicate, invalid, wrong-amount and receiver-mismatch slips stop checkout and prompt a new upload/COD.
- Slip2Go service unavailable, invalid central credentials, quota exhausted or throttling triggers manual cashier review; OCR fallback cannot authorize automatic payment. Central credit usage capped by IP + tenant burst rate and unique bank transaction reference ledger.
- Added finalizeDeliveryPaymentSlip Firestore onCreate trigger to transition pending_verification to paid only on fresh, exact matching server proof. Otherwise kitchen entry remains gated.
- Kitchen filters unpaid PromptPay from cards; cashier sees every created Delivery order including COD and manual-review slips, with manual-confirm-and-send-to-kitchen button.
- Added notifyKitchenDeliveryAdmitted event to notify kitchen upon COD creation or verified/approved PromptPay transition. Existing cashier creation notification unchanged.
- Updated tenant Firestore order update security rule to stop kitchen role changing paymentStatus/slipVerificationStatus itself.
- Customer can change from locked PromptPay to COD and see localized slip errors and receipt statuses (TH/EN/MM/LO/KM).
- Added unit/contract tests for slip decisions, duplicate/mismatch, downtime, exact proof binding, COD/PromptPay gate, frontend wiring.
- Preserve generated hashed bundles; do not merge main. Cloud Function/Firestore Rules/Hosting deployment required.
- Caveat: payment receiver validation is based on merchant PromptPay proxy and exact amount/cart; independent server recomputation of every dynamic Lalamove/Google delivery quotation is not implemented.


### Build 2026.10.08.483 — Payment security checks and shipping fee handling
- Client-supplied delivery fees cannot authorize an automatic paid status without independent server verification. Server checks original tenant Lalamove quote snapshot (new function quotePublicLalamoveDelivery persistence), tenant manual-zone fees, or cached verified Google route before automatic Slip2Go acceptance.
- When delivery fee cannot be independently confirmed, fallback is cashier manual review; when an authoritative fee conflicts with the checkout fee, reject as amount mismatch. This prevents automatically authorizing forged small shipping fees.
- For PromptPay delivery, direct Firestore staff updates to payment-related fields are blocked (including owner/admin/cashier/kitchen), while trusted Cloud Functions use Admin SDK.
- Updated Firestore Rules syntax to use negated affectedKeys().hasAny; dry-run now compiles without invalid hasNone warning.
- NOTE: A few custom/legacy delivery-zone configurations may require cashier manual review until full authoritative fee validation is extended.

---

### 2026-10-08 — Delivery Slip2Go Build 2026.10.08.483 candidate completion (NOT DEPLOYED)

Final candidate behavior:
- Scope remains Restaurant/Cafe Delivery only; Retail POS is unchanged.
- PENGUIN central Slip2Go credentials/credits perform customer slip verification while the receiver is overridden to the tenant store's own PromptPay phone/tax-ID proxy.
- Customer flow:
  - duplicate / wrong amount / wrong receiver / invalid slip is rejected before order creation;
  - customer can upload another slip or switch payment method to COD;
  - service/config/quota/rate-limit or non-authoritative delivery-fee cases fall back to Cashier manual review instead of pretending verification passed.
- Automatic paid admission requires a fresh server proof bound to tenant/order, uploaded slip path, server menu subtotal, authoritative delivery fee, total amount, sorted cart signature and Slip2Go transaction reference.
- Delivery fee is server-confirmed from persisted Lalamove checkout quotation, verified Google route cache + configured fee tier, or server-known manual fee rule. If it cannot be independently established, the result is manual review.
- Global duplicate protection uses the bank transaction reference in platformSlipUsedReferences.
- Cashier sees every Delivery order regardless of COD / prepay / manual review.
- Matched Slip2Go orders are server-marked paid and do not need a receive-payment button.
- Manual PromptPay approval calls trusted approveDeliveryPaymentReview, validates tenant/role/order/proof binding, and records reviewer UID/email/role/time before releasing Kitchen.
- Kitchen admits COD immediately; PromptPay stays hidden until server-paid; admission notification is emitted only when Delivery becomes admitted.
- Firestore Rules protect payment/slip-review fields from staff client writes while paymentReviewRequired=true; trusted Cloud Functions use Admin SDK.
- New customer/Cashier outcome copy is localized in TH/EN/MY/LO/KM.
- Existing Delivery-create owner/Cashier notification remains unchanged.

Security/reliability hardening:
- Removed an undefined verified guard in Delivery proof creation.
- Server owns manual-review state on order creation.
- Expired/non-service proof paths remain reviewable instead of stranding the order.
- Manual-review Firestore protection applies only when paymentReviewRequired=true, avoiding over-locking unrelated legacy PromptPay flows.
- Receiver type confirmed against the existing Slip2Go dictionary: 02001 PromptPay phone, 02003 PromptPay national/tax ID.

Verification:
- Implementation source commit already pushed: ed16dcc8 — feat: verify restaurant Delivery slips via central Slip2Go with cashier fallback.
- Functions syntax checks: PASS.
- npm run test:operational: PASS.
- npm run test:react-parity: PASS.
- Slip2Go + Kitchen admission regression in the standard suite: 12/12 PASS.
- React callable contract: 61 references / 0 missing exports.
- Firestore Rules dry-run: compiled successfully.
- Targeted Functions dry-run for verifyDeliveryPaymentSlip, finalizeDeliveryPaymentSlip, approveDeliveryPaymentReview, notifyKitchenDeliveryAdmitted: PASS.
- npm run build:react: PASS.
- Generated React build contract: PASS — Build 2026.10.08.483, bundle /react/assets/index-BFsKHcE-.js.
- Hosting-emulator P0 browser smoke: 52/52 PASS.
- Hosting-emulator Delivery parity: 6/6 PASS.
- Delivery Success parity: 5 skipped / 0 failed because no success-order fixture was supplied.
- git diff --check: PASS.

Deployment boundary:
- NOT DEPLOYED.
- Production remains React Build 2026.10.08.482.
- Do not deploy Hosting alone because the .483 frontend calls new Functions and relies on the new payment-review Rules.
- Coordinated Production release must include Hosting + the four Functions above + Firestore Rules.
- Project policy requires explicit user authorization before Functions/Firestore Rules deployment.
- No merge to main.


### 2026-10-08 — Delivery Slip2Go Build .483 PRODUCTION DEPLOYED
- User explicitly authorized coordinated release of Functions + Firestore Rules + Hosting.
- Functions successfully deployed to chat-45754 / asia-southeast1: verifyDeliveryPaymentSlip, finalizeDeliveryPaymentSlip, approveDeliveryPaymentReview, notifyKitchenDeliveryAdmitted, quotePublicLalamoveDelivery (5/5).
- Firestore Rules compiled and released successfully to cloud.firestore.
- Firebase Hosting foodapp / penguin-food release completed successfully.
- Production /admin and /delivery both reference index-BFsKHcE-.js; direct JavaScript asset responds HTTP 200.
- npm run test:delivery-slip2go PASS 12/12; Operational PASS; React parity and Build .483 passed before release.
- No functions/Storage outside specified 5, no merge to main. Pre-existing untracked generated bundles preserved.
- IMPORTANT: authenticated E2E tests of Slip2Go with genuine customer slip/merchant bank receiver, confirmation notifications and cashier manual release were not executed against live orders. Do not represent production payment flow as field-verified until real account tests.
- Future work: evaluate receiver confirmation, Google/Lalamove fee edge cases, unknown Slip2Go result codes, replay prevention and production monitoring with sanitized logs.


## 2026-10-08 — Delivery mobile category sticky strip + scroll tracking (Build 2026.10.08.484)
- Mobile Delivery category tabs stay sticky at top, while search input scrolls normally with menu list rather than remaining fixed with tabs.
- Delivery category scroll-spy now highlights the category matching the currently browsed menu card when browsing All (without search); the horizontal strip auto-centers the active category.
- Table Order scroll-spy behavior remains unchanged, Desktop remains unaffected, no payment/Slip2Go backend or data changes.
- Operational, React Parity and build checks PASS; dedicated mobile scroll regression PASS 3/3.
- Hosting only; no Functions/Rules and no main merge.


### Delivery mobile category scroll — Production checkpoint Build .484
- Implementation commit 3f4cb08a pushed to feature/react-firebase-port.
- Firebase Hosting foodapp deploy completed successfully; no Functions, Firestore Rules, Storage or tenant-data changes.
- Production /s/saas-test-shop/delivery references index-DpiOhGZu.js; asset HTTP 200 and mobile-menu-scroll.css includes sticky-tabs override.
- Automated tests passed; authenticated iPhone/mobile visual scroll smoke is not yet verified on a real browser.
- No main merge; old untracked hashed bundles preserved.


## 2026-10-08 — Delivery mobile category viewport pin corrective (Build .485)
- User reported .484 does not work on mobile.
- Replaced unreliable sticky-only category tab behavior with scroll-position viewport fixed class applied to categoryTabs alone, plus scroll anchor placeholder to prevent page jumps.
- Search remains in normal document flow. Category highlight tracking and auto horizontal centering retained, Table Order unaffected.
- Operational, React Parity, generated Build contract, mobile regression tests PASS. Hosting-only release; no backend/rules changes.


### Delivery Mobile Build .485 — Production checkpoint
- Implementation 7df5d1f6 pushed to feature/react-firebase-port and Firebase Hosting foodapp deployed successfully.
- Live Delivery URL loads index-BZvgTYkY.js; JS asset returns 200 and new viewport pin CSS served.
- Mobile scroll regression 4/4 and React parity/build tests PASS. No backend/functions/rules deployed.
- Authenticated physical/mobile browser scroll outcome still unverified; user reported previous .484 faulty. Preserve user untracked asset bundles and do not merge main.


## 2026-10-08 — Delivery mobile fixed categories AND search (Build .486)
- User clarified both category strip and search box must stay pinned on mobile Delivery.
- Moved anchor outside .menu-filter-area and pin entire filter toolbar to viewport via delivery-filters-fixed class while scrolling, with spacer to avoid content jump.
- Category scroll-spy/highlight and horizontal scrolling remain. Desktop and Table Order unchanged.
- Delivery mobile regression 5/5, React Parity and React Build contract PASS. Hosting-only.


## 2026-10-08 — Cashier legacy payment and Kitchen order audio candidate (Build .487, NOT DEPLOYED)
- User screenshot shows legacy Delivery PromptPay order dated 07/10/2026 with slip, Cashier payment failure after stricter .483 Rules.
- Root cause: older orders lack server proof/paymentReviewRequired, so Cashier used direct Firestore paid update which new Rules correctly deny.
- Candidate: route all Delivery PromptPay cashier settlements to trusted approveDeliveryPaymentReview Callable. Accept only legacy order created before 2026-10-08 00:00 +07, with nonzero amount and existing slip pointer when server proof does not exist; record reviewing staff identity/time and release Kitchen. New orders still require signed server manual-review proof. Allow manager role consistently with frontend.
- Kitchen audio issue: CashierOrderNotifier saw all pending orders even before paid confirmation, so Kitchen admission after cashier payment was not a new ID. Now Kitchen notifier filters on deliveryKitchenAdmitted, Cashier notifier remains all orders. Browser needs staff sound button gesture to arm WebAudio due autoplay.
- No production tenant records changed. New Cloud Function version required for legacy payment compatibility. Project requires explicit user approval before Functions deployment; do not release Hosting alone.


### Build .487 — Production release confirmation
- User explicitly approved coordinated deploy of approveDeliveryPaymentReview and Hosting.
- Firebase Functions (approveDeliveryPaymentReview, asia-southeast1) updated successfully on chat-45754; Hosting foodapp deployed successfully.
- Old pre-Slip2Go slip records may now be approved by cashier via trusted callable with staff audit; newer orders require authoritative proof.
- Kitchen notifier now notices new *admitted* Delivery orders and can announce them with WebAudio once sound is enabled/unlocked by user interaction.
- Live /cashier references index-B1NTOMkh.js, asset responds HTTP 200.
- No Firestore Rules change and no main merge. Real-payment and real-browser audio smoke tests remain pending; browsers may require pressing bell first.

## 2026-10-08 — Quick Order pairing QR routes to Retail POS: investigation and source repair .488 (NOT DEPLOYED)
- User found Quick Order customer display /pos/customer-display?displayId=quick-order-* pairing QR + Open POS linked Retail POS. Prior d126ac8 only adjusted QR target path and was prematurely presented as resolved despite no build/deploy.
- Source issues: POS customer display under /pos got Retail MasterBusinessGuard restrictions, QuickOrderPage ignored registerId/displayId query and generated display identity only from logged-in user, login redirect dropped paired display query.
- Source changes: /cashier/customer-display route reuses read-only PosCustomerDisplayPage for restaurant; QuickOrderPage customer-display launch points to this restaurant route and accepts validated quick-order-* paired IDs; pairing QR/link returns to /cashier/quick-order with same displayId; login redirects preserve pathname+search; legacy /pos/customer-display quick-order IDs permitted under restaurant guard without enabling Retail POS.
- Added tests/react-parity/quick-order-display-pairing.spec.mjs with pairing route, ID continuity, auth preservation, and Master guard checks, included in npm run test:react-parity.
- Prepared Build .488 in react-app/src/config/release.js. Desktop Commander quota exhausted; GitHub source commits only; no tests, actual Vite build, browser E2E, Firebase deploy or production verification have occurred. Production .487 still active.
- Follow-up: run Mac pull/build/tests, deploy hosting:foodapp only, test QR scan as different cashier login & old/new display links, confirm Firestore document ID shared between screen and cashier. Preserve all untracked build artifacts and do not merge main.

## 2026-10-08 — Quick Order cashier back-arrow alignment, Build .489 (SOURCE ONLY, NOT DEPLOYED)
- User screenshot /cashier/quick-order: arrow icon within กลับหน้าแคชเชียร์ needs Y-axis centering on desktop and both X/Y centering on mobile.
- Fixed only .quick-order-page .quick-header-back and child Bootstrap icon in react-app/public/parity/css/quick-order.css; icon uses 18x18 px centered grid and pseudo-element line-height normalization. Mobile <=640px uses a centered 40x40 px square control.
- Added aria-label/title for mobile (button text hidden) in QuickOrderPage.jsx.
- Added tests/react-parity/quick-order-back-icon-alignment.spec.mjs to npm run test:react-parity.
- Prepared Build 2026.10.08.489; includes still-unreleased .488 Quick Order screen pairing fixes from earlier handoff.
- GitHub source static checks 8/8 PASS, but npm/build/browser tests NOT RUN due to Desktop Commander monthly quota. NO Firebase Hosting deploy; Production remains .487. No changes to backend or Firestore.
- To ship: on Mac run git pull --ff-only origin feature/react-firebase-port, npm run test:operational, npm run test:react-parity, npm run build:react, npx firebase-tools deploy --only hosting:foodapp --project chat-45754. Confirm mobile arrow centering and QR pair flow in authenticated browser.
- Do not clean/reset old generated hashed bundles, do not merge main.

## 2026-10-08 — Delivery PromptPay QR PNG + successful checkout Back safety + Quick Order receipt/audio (Build .490)

User reports:
1. Delivery payment-lock QR download fails on mobile; desktop downloads a file that cannot be opened.
2. After submitting a successful Delivery order, browser Back can restore the locked old checkout or an empty cart with an old amount, misleading customers into attempting a repeat order.
3. Cashier Quick Order print leaves an orphaned receipt tab; returning to Cashier can play an already-handled Walk-in order notification again.

Root causes:
- Delivery used local qrDataUrl() which produces data:image/svg+xml, but the HTML download attribute saved those SVG bytes with a .png filename.
- Delivery navigated to Success via location.assign(), preserving the submitted checkout history entry and its browser-restored payment-lock/cart state.
- Quick Order's auto-print did not explicitly close its script-opened receipt tab. Cashier notifier considered walkin/cashier_walkin orders with paymentStatus=paid and status=pending to be newly incoming cashier orders; the audio component could also mount before its first realtime orders snapshot when load watchdog elapsed.

Changes:
- react-app/src/utils/downloadQrPng.js: rasterizes the existing local SVG QR to a 640px white-backed PNG Blob with nearest-neighbor pixels. DeliveryPage prepares a scoped Object URL before click, uses a native download anchor (mobile browser gesture preserved), disables the button while the PNG is unavailable and revokes URLs on source changes/unmount. PromptPay payload, receiver, fee and payment proof logic remain untouched.
- react-app/src/pages/DeliveryPage.jsx: only after createPublicDeliveryOrder and the best-effort customer profile save, reset cart/gifts/slip/payment lock and use location.replace() for success instead of location.assign(). No early reset on failed upload/verification/order creation.
- react-app/src/components/orderAlertEligibility.js + CashierOrderNotifier.jsx: suppress **cashier audio only** for already-paid cashier-origin Walk-in orders. Kitchen notifications and legitimate customer/takeaway/delivery alerts are unchanged.
- react-app/src/pages/CashierPage.jsx: only mount the notifier after the first successful realtime orders snapshot so a late initial load cannot be mistaken for new orders.
- react-app/src/pages/QuickOrderPage.jsx + CashierReceiptPage.jsx: mark only Quick Order auto-print with closeafterprint=quick-order; after print dialog closes, attempt to close the script-opened tab, otherwise return to /cashier/quick-order. Normal receipt routes keep existing behavior.
- tests/react-parity/delivery-qr-checkout-quickorder-receipt.spec.mjs and package.json: five targeted regressions, included in test:react-parity. React release bumped to 2026.10.08.490.

Verification before release:
- npm run test:operational PASS.
- npm run test:react-parity PASS, including all 5 new tests and prior Slip2Go/Kitchen/Quick Order contracts.
- npm run build:react and verify:react-build PASS (2026.10.08.490, /react/assets/index-BC-WUDBh.js).
- git diff --check PASS.
- Google Chrome (real installed macOS Chrome via Playwright) Desktop 1280x720 and mobile touch emulation 440x956 each generated and downloaded a real PNG (12,332 bytes; valid PNG signature), PASS. This is browser testing of the QR converter; not an authenticated customer payment/order.
- Production 2026.10.08.489 was independently observed before these changes at /cashier/quick-order, referencing index-BCW1U1rO.js; its asset content matched local SHA-256 even though the previous handoff incorrectly said it was undeployed.

Safety / remaining validation:
- Frontend and Hosting only. No Functions, Firestore Rules, Storage Rules, tenant data changes, payment state changes, or merges to main.
- Do not place a paid customer order purely for smoke tests.
- After Hosting release, verify canonical HTML/JS and perform user-assisted real mobile Safari QR download, Delivery successful-order Back behavior, and Quick Order receipt print/alert in a genuine staff session.
- Pre-existing untracked historical hashed assets must remain; do not reset/clean/delete.
- Git commit/push and Hosting deploy status: pending at this entry; add a production checkpoint after successful release.

### Build .490 — Git push and Production Hosting confirmed

- Implementation, regression, generated .490 asset, and prior .489 bundle committed in `fad923ad` (`fix: download Delivery QR PNG and prevent checkout/receipt alert replay`), pushed to `origin/feature/react-firebase-port`.
- Firebase Hosting target `hosting:foodapp` deployed successfully to `https://penguin-food.web.app` under project `chat-45754`. 548 public files served; release finalized. No Functions, Firestore Rules, or Storage Rules deploy.
- Live canonical URL checks PASS (all HTTP 200, all serve `/react/assets/index-BC-WUDBh.js`): `/s/saas-test-shop/delivery`, `/cashier/quick-order`, `/cashier/receipt`, `/cashier`, `/kitchen`.
- Live JS asset HTTP 200, byte-for-byte SHA-256 same as Mac candidate (bdeb4780452079ee1e9594fbe0e8296e07bd8f9727f9d59967ca68708b3ec976), contains Build `2026.10.08.490`. Old `/react/assets/index-BCW1U1rO.js` remains HTTP 200 with JavaScript MIME type.
- Local Browser QR PNG download smoke: Desktop and emulated mobile-touch PASS, actual PNG file and signature validated. No authenticated live Delivery orders/payment attempts or Quick Order printing/notifications executed by automated smoke. Genuine iOS/Safari receipt/back/notification workflow still awaits user acceptance.
- Existing historic untracked Vite hashed assets preserved; main not merged. Follow-up if user finds device-specific issues: inspect Safari download and the print-dialog afterprint behavior rather than changing payment backend.

## 2026-10-08 — Self-delivery driver Google Maps sharing (Build .491)

Request:
- The store wants to share a customer's pinned Delivery destination with its own delivery driver, so the driver can open navigation in Google Maps.
- Scope explicitly limited to **store-managed self-delivery**, not Lalamove. Location auto-detect/saved-address accuracy was reported separately and remains an independent unresolved task.

Implementation:
- `react-app/src/utils/deliveryDriverShare.js`: only self-delivery orders (including legacy providerless self-orders without Lalamove evidence) can generate Google Maps driving Directions URLs. Explicit Lalamove/other-provider orders and orders with Lalamove quotation/dispatch evidence are excluded. Coordinate validation rejects missing, nonnumeric, out-of-range and 0,0 pins. Destination comes exclusively from each order's immutable-at-share-time `deliveryLatitude`/`deliveryLongitude`, never the cashier's current device location.
- `react-app/src/pages/CashierPage.jsx`: inside each self-delivery order card, a separate driver panel displays `ตรวจสอบบน Google Maps` and `แชร์พิกัดให้คนขับ`. The share action uses the device's native share sheet on supported mobile devices (e.g. LINE as a selectable destination). Where unavailable, copies the order queue/address plus Maps link to the clipboard; if clipboard is blocked, presents a read-only link for manual copying. Cancelling native share does not copy anything. Missing coordinates disable sharing and show an explicit warning; Lalamove cards display no self-delivery driver panel. No staff/customer personal phone is included in the share payload.
- `react-app/public/parity/css/cashier-refresh.css`: isolated driver buttons with visible labels, 8px action gaps, 40px minimum control height, and responsive wrapping, independent of the icon-only mobile payment actions.
- `react-app/src/i18n/parity-translations.json`: TH/EN/MY/LO/KM text for driver actions, hints, errors, copied status, and message template.
- `tests/react-parity/self-delivery-driver-share.spec.mjs` + `package.json`: six targeted regressions wired into `test:react-parity`.
- `react-app/src/config/release.js` bumped to Build 2026.10.08.491, marker SELF-DELIVERY-DRIVER-MAPS-SHARE. README release identity reviewed and updated.
- No order schema, payment statuses, tenant documents, Cloud Functions, Firestore Rules or Storage Rules are changed.

Verification:
- `npm run test:self-delivery-driver-share`: 6/6 PASS (provider guards, coordinates, URL, scoped UI, browser-native share/clipboard fallback, five translations).
- `npm run test:operational`: PASS.
- `npm run test:react-parity`: PASS (prior contracts also pass).
- Chrome installed on Mac used for local CSS responsive test at 320, 390, 440 and 1024 pixels: button text visible, >=40px height, zero horizontal overflow in isolated panel, all PASS. Not an authenticated production order test.
- `npm run build:react` + postbuild generated contract: PASS; final bundle `/react/assets/index-cdWz40EM.js`, React Build 2026.10.08.491; `git diff --check`: PASS.
- Current production before release is Build .490. Do not report .491 as live until release verification.

Release/safety:
- Preserve all pre-existing untracked historical hashed assets; no Git reset/clean/discard.
- Firebase deployment scope is Hosting:foodapp only; no Functions, Rules, schema, or customer writes.
- Remains to verify staff use on real phone and desktop (native share/LINE and clipboard), and independently repair Delivery GPS-vs-saved-address precision logic in a separate task.
- Git commit/push and Hosting release pending at this checkpoint; add a production-confirmation entry on success.

### Self-delivery Driver Share Build .491 — Production Hosting confirmed

- Commit `35833f0c feat: share self-delivery customer map pins with drivers` pushed to `origin/feature/react-firebase-port` successfully; local/remote branch ahead/behind `0/0`.
- Firebase Hosting `hosting:foodapp` deployed successfully, project `chat-45754`, Hosting URL `https://penguin-food.web.app`. Upload/release confirmed (550 public files). No Cloud Functions, Firestore Rules, Storage Rules or tenant data deploy.
- Live canonical `/cashier`, `/cashier/quick-order`, `/s/saas-test-shop/delivery` and `/kitchen`: HTTP 200, all reference `/react/assets/index-cdWz40EM.js` Build 2026.10.08.491.
- Live bundle HTTP 200, 3,566,604 bytes, SHA-256 equal to Mac build `8e5303f4f659485c088b2c57d6c4881a12d2778469f2924c4b0bfbc861d5de90`. Live Cashier CSS `/react/parity/css/cashier-refresh.css` HTTP 200, byte-identical to Mac and includes driver controls. Prior .490 bundle still HTTP 200.
- Browser visual smoke was an isolated static driver-panel exercise with Chrome at 320, 390, 440 and 1024 px, not authenticated Firebase order E2E; native share/LINE on a real staff device remains user acceptance.
- Historical untracked hashed Vite bundles retained; no clean/reset/main merge. GPS current-vs-saved location auto-matching is **not** fixed and should be addressed separately, to avoid sharing inaccurate customer pins.

## 2026-10-09 — Delivery GPS vs Saved Address pin integrity (Build .492)

User-reported defect: automatic location detection and saved address lookup show different/wrong pins on customer Delivery; already-shared driver Google Maps links use the saved order pin and therefore require trustworthy coordinates.

Confirmed root causes in previous .491 source:
1. `NEARBY_SAVED_ADDRESS_METERS = 100`: using GPS within 100m of a saved address immediately called `selectAddress(nearest.address)`, overwriting the actual GPS with the saved pin. A later effect repeated the same fuzzy snap once guest profile had loaded.
2. Selecting a saved address updated Google Maps marker position but did not pan the map viewport, so the selected pin could be off-screen and the map could appear to show another location.
3. Editing **any** saved address used the *checkout's* `deliveryLocation` instead of that address's own coordinate, thereby silently rewriting stored pins.
4. After successful checkout, a matching address-text record was silently updated with the order's current coordinate, corrupting previously saved pins even if the customer had not edited that saved address.
5. Browser `getCurrentPosition` accepted coarse/cached geolocation results (maximumAge:15000), without checking `coords.accuracy`.
6. Checkout did not require the customer to verify the map pin; map events captured stale `disabled` state when checkout became locked.

Fix:
- `DeliveryPage.jsx`: removed proximity based saved-address matching entirely. Initial default saved address still prefills once; explicit selections always use that saved record's coordinates, and user GPS/map selection always keeps the exact chosen GPS/map coordinate (never snaps to a saved address). Invalid saved pins clear any previous pin; selected saved address text is cleared if the customer chooses a different GPS/map position, rather than incorrectly associating old address text with new coordinates.
- Checkout requires explicit “map pin is correct” checkbox before payment-lock/order submission; changing pin, chosen saved address or delivery address text resets confirmation. Saved-address options and address text are disabled while payment is locked.
- Saved-address editor now has its **own** Google Maps instance, GPS location action and `addressEditor.latitude/longitude`. Editing existing entry loads that entry's coordinate; adding a new entry starts unpinned, never copies a preselected Checkout pin. Explicit Save Address is the **only** way to persist address-book coordinates; checkout no longer silently saves or rewrites saved-address pins.
- `DeliveryLocationPicker.jsx`: re-centres map to selected external marker, shows GPS estimated precision, requires fresh high-accuracy fixes (maximumAge:0, enableHighAccuracy:true, timeout:20000) and refuses to move pin if estimated accuracy exceeds 100m or is unavailable; asks user to retry or drop map pin manually. Disables Google Maps marker drag/click when checkout locked, including listeners created before locking. Distinct DOM IDs for address editor and checkout. Retry map API load after transient failure.
- `deliveryLocationPolicy.js`: centralized strict lat/long and estimated GPS accuracy guard. `delivery-location-map.css` scopes editor styling and pin-confirmation checkbox. `parity-translations.json`: localized labels, guidance, warnings in th/en/my/lo/km. Updated legacy `tools/react-foundation-contract.mjs` to explicitly forbid 100m snap; new `delivery-location-integrity.spec.mjs` with eight regression cases wired into `test:react-parity`.
- Bumped React release Build `2026.10.09.492`, README metadata updated.

Verification (all on authorized Mac):
- Targeted 8/8 location integrity regressions PASS.
- Operational contract PASS.
- Complete `npm run test:react-parity` PASS including prior Slip2Go, QR, kitchen notification and driver-share contracts.
- React build and postbuild-generated contract PASS. **Final** main index JS: `/react/assets/index-CsqMnk5f.js`; Build `2026.10.09.492`. `git diff --check` PASS.
- Live Google Chrome local-static-server *browser* smoke with guest address A 13.82984,100.64208 and B 13.82986,100.64210, GPS 13.82990,100.64215 (within 100m): initial saved A correct, clicking GPS keeps distinct GPS coordinate and clears saved selection/confirmation, editing saved B shows its own B coordinates. PASS.
- Chrome coarse GPS fix simulated `coords.accuracy=350m`: saved A pin remains unchanged, Thai warning shown about ±350m. PASS.
- No production customer profiles/orders inspected or changed. These tests mock geolocation/guest localStorage and are not genuine GPS device accuracy or physical-doorstep geocoding validation.

Remaining user acceptance:
- Have customer open Delivery on **real iPhone/Android**, allow Precise Location, compare fresh GPS location vs a saved pin; repair any previously corrupted address-book pin by **explicit Edit Address + drag/pin + Save**. The old saved coordinates cannot be corrected automatically without a trusted ground truth.
- Verify a real customer Order GPS pin is correct before using driver-share; no live real-payment test was initiated.
- Commit/push, Hosting deploy and live bundle verification pending when this note was initially written. No Functions or Firestore/Storage Rules deployment, no main merge, and do not delete old Vite hashed bundles.

### Build .492 — Git / Hosting deployment / live GPS smoke CONFIRMED

- Implementation commit `f6769081 fix: preserve accurate Delivery GPS and saved address pins` pushed successfully to `origin/feature/react-firebase-port`; ahead/behind `0/0`.
- Firebase Hosting `hosting:foodapp` deployed to project `chat-45754` successfully. 552 public files, release completed at `https://penguin-food.web.app`. No Functions, Firestore Rules or Storage Rules change.
- Live canonical routes `/s/saas-test-shop/delivery`, `/delivery`, `/cashier`, `/kitchen`: HTTP 200 and reference `/react/assets/index-CsqMnk5f.js`. Exact live and Mac JS byte match, contains `2026.10.09.492`, SHA-256 `92ab672251aa615831efe0c134966322e711e1063c94058f7dc105625e77e14f`; live `delivery-location-map.css` byte-identical. Previous `index-cdWz40EM.js` (.491) remains accessible.
- **After deployment**, Chrome against real `https://penguin-food.web.app/s/saas-test-shop/delivery` with isolated guest profile fixture / browser-injected GPS (no production data writes) PASS: Saved A 13.8298400,100.6420800; GPS 13.8299000,100.6421500 remains distinct, not snapped to Saved A; editing Saved B preserves its own 13.8298600,100.6421000 coordinate. Local Chrome coarse GPS accuracy=350m PASS (warning shown, original pin retained).
- Outstanding manual acceptance: real phone precise-location permissions/GPS, adjust and explicitly Save incorrect historical pins. No real customer order/payment or authenticated customer-profile writes were made. Never auto-fix historical saved pins without verified ground truth.

## 2026-10-09 — Laravel MASTER GPS-nearest Delivery parity + store-origin driver navigation (.493)

Requested:
- On opening customer Delivery, auto-detect GPS and select the nearest saved delivery address first, as Laravel did, on desktop and mobile. Prior Build .492 intentionally disabled GPS-to-saved matching, which did not match user's requested Laravel behavior.
- When sharing Self Delivery navigation to a driver, use the configured **store** pin as route origin and the **customer order** pin as destination; not the driver's or cashier's current GPS.

Laravel source checked (read-only at /Users/natchanonsripleng/Desktop/Sites/food-order-app-php80, branch main):
- `public/assets/js/delivery-location-map.js` auto-runs `requestCurrentLocation({automatic:true})` on entry, uses browser GPS with high accuracy, and exposes the initial request to the address book.
- `public/assets/js/delivery-location-address-resolver.js` matches `nearestSavedAddress()` only for `source==='current-location'`, with `NEARBY_SAVED_ADDRESS_METERS=100`; direct map clicks are explicit and must never re-snap.
- `public/assets/js/delivery-addresses-normal-button.js` waits for initial GPS request, falls back to preferred saved address if GPS is unavailable, and supports explicit saved address overrides.

Implementation:
- `react-app/src/utils/deliveryLocationPolicy.js`: restored haversine closest valid saved-address selection with 100m limit (GPS only), and kept strict coordinate and GPS-accuracy checks.
- `react-app/src/pages/DeliveryPage.jsx`: on initial mount request fresh high-accuracy GPS (Desktop and Mobile, maximumAge 0). Wait for both GPS result and customer profile; if a saved address is within 100m, preselect **nearest** record regardless of its `isDefault` flag and center map on its exact saved pin; if no saved pin is nearby, keep the GPS coordinate without selecting an unrelated saved card; if denied/coarse/unavailable, fall back to default saved address. Explicit choice while GPS loads wins, and subsequent manual map clicks/drags never snap to a saved address. Manual 'Use current location' also selects the closest saved address when appropriate. Keeps .492 protections: independent Saved Address editor pin, no silent saved pin rewrite, customer pin confirmation, and payment-lock protection.
- `react-app/src/utils/deliveryDriverShare.js`: changed Maps Directions link to require validated `origin=storeLatitude,storeLongitude` and `destination=order.deliveryLatitude,order.deliveryLongitude`, travelmode driving, retaining store-delivery-only guard. Missing store or customer coordinates result in no sharing URL, never fallback to current device GPS.
- `react-app/src/pages/CashierPage.jsx`: read the existing `tenants/{tenantId}/settings/store` document with **existing** `getOperationalStoreSettings` helper (already in operationalData; no data layer changes needed) and pass validated store coordinates to both Maps link and native share/copy action. While store settings are unavailable or lack valid coordinates, disable sharing and show an explicit store location configuration hint. Lalamove cards remain excluded.
- `react-app/src/i18n/parity-translations.json`: missing store pickup location notice in TH, EN, MY, LO, KM.
- Updated `tools/react-foundation-contract.mjs`, `tests/react-parity/delivery-location-integrity.spec.mjs`, and `tests/react-parity/self-delivery-driver-share.spec.mjs` to verify restored Laravel 100m nearest selection plus store-origin route and missing-pin safety.
- Release bump: Version 0.4.280, **Build 2026.10.09.493**; README reviewed/updated.

Verification:
- `npm run test:delivery-location-integrity`: 9/9 PASS (including nearest match, threshold, map no-snap, pin-safety).
- `npm run test:self-delivery-driver-share`: 6/6 PASS including explicit shop origin and destination, invalid/missing origin blocked, provider scoping and all five languages.
- `npm run test:operational`: PASS.
- Full `npm run test:react-parity`: PASS after updating obsolete default-first foundation contract.
- `npm run build:react` and generated postbuild contract: PASS with `/react/assets/index-CkmdkY6R.js` main JS; `git diff --check`: PASS.
- Chrome on authorized Mac using local production build (no real customer writes), separate PC 1280px and mobile 440px browser sessions: initial saved default A and nondefault closer B, GPS closest to B; **auto-selects B** without clicking GPS. Manual user selection of A persists, without being overwritten. GPS-denied scenario falls back to A. All PASS.
- Real device location quality still depends on browser OS permissions and GPS accuracy. Previously incorrectly stored pins are not auto-corrected without verified ground truth.

Safety and delivery:
- Only React/Hosting changes, no Firestore/Storage Rules or Cloud Functions deploy, no customer profile/order updates, no main merge.
- Existing untracked Vite hashed bundles preserved (emptyOutDir:false).
- Git commit/push and Hosting production release pending at note creation; record final live JS verification after deploying.

### Build .493 — Implementation pushed, Hosting Production, and read-only live browser checks confirmed

- Implementation commit `bbd881f9 feat: restore Laravel nearest delivery location and store-origin driver maps` pushed successfully to `origin/feature/react-firebase-port`, ahead/behind 0/0 at push.
- Firebase Hosting only `hosting:foodapp`, project `chat-45754`, deployed successfully to `https://penguin-food.web.app`. 553 public files; no Cloud Functions, Firestore Rules, Storage Rules, or live customer records changed.
- Production canonical `/s/saas-test-shop/delivery`, `/delivery`, `/cashier`, `/kitchen` all HTTP 200 referencing `/react/assets/index-CkmdkY6R.js`. Bundle live matches Mac byte-for-byte with Build `2026.10.09.493`, SHA-256 `d7cf25788d4b52adafa32c2cf60347e54f6bfadaccbf74c17b9a10eef0d71aac`. Prior .492 bundle remains readable.
- After release, **real Production HTTP/Chrome guest-mode smoke** with synthetic localStorage address fixture and browser-mocked GPS: PC 1280px and Mobile 440px both auto-select nondefault Saved Address B over default A because it is nearer GPS; coordinates of B confirmed on screen. GPS permission-denied case falls back to default A. No production customer profile mutations, checkout/payment, or order creation were performed. All PASS.
- Driver Maps link unit tests verify `origin=storeLatitude,storeLongitude` and `destination=deliveryLatitude,deliveryLongitude` plus refusal to provide links when store pin or order pin missing. Real authenticated Cashier & Google Maps app flow requires store staff manual smoke; no test pretended that the user's real phone GPS was accessible.
- Never merge main or remove old hashed bundles; existing untracked historical assets preserved.

## 2026-10-09 — Delivery saved-address map marker race + address-first GPS selection (Build .494)

User-visible defect: after the .493 Laravel-nearest saved-address fix, address and latitude/longitude were selected but the Google Maps marker was not reliably displayed on either PC or mobile. Desired workflow: load the saved address book before checking nearest to current GPS; if none is nearby, show the current GPS point and have the customer verify their address/pin with the store. A saved point must always display a marker.

Root causes confirmed:
1. In `DeliveryLocationPicker.jsx`, the map initialization effect depended only on `slug,language` and captured an initially empty `normalized` coordinate. It created a hidden marker at the Bangkok fallback; when saved address/GPS arrived before asynchronous Google Maps init completed, the coordinate effect returned early because `mapRef.current` was null. Map creation then used stale `normalized=null` and left marker hidden, even though React showed the chosen coordinates.
2. Google Maps click/drag handlers captured the original React `onChange` callback, potentially using stale saved-address selection state when changing the marker manually.
3. The initial GPS request could start before loading the customer address book, so matching occurred correctly only later but did not have the requested address-first sequencing.

Changes:
- `react-app/src/components/DeliveryLocationPicker.jsx`: use `locationRef.current` for the latest location once Maps JS resolves; after `mapState=ready`, force sync marker visibility, position, map centre and zoom >=16 from latest React value, and hide marker if location becomes invalid. Clean up marker when map changes/unmounts. Use `applyRef.current` in Google Maps event listeners to avoid stale parent callback.
- `react-app/src/pages/DeliveryPage.jsx`: request initial GPS only after the tenant's customer profile (saved addresses) has finished loading, then compare the GPS point against the saved book under Laravel 100m nearest-address rule. A confirmed manual selection is still respected. Existing precise GPS checks and explicit customer pin confirmation still apply.
- For no nearby saved address, display an actionable confirmation notice that the customer must enter delivery address and verify pin with the store before ordering; for GPS unavailable, clarify that saved default is a fallback. Keep existing required address, pin checkbox and locked-checkout controls.
- Localized the two new notices in TH/EN/MY/LO/KM (`parity-translations.json`), plus responsive CSS (`delivery-location-map.css`).
- Added two focused marker lifecycle and address-first regressions to `tests/react-parity/delivery-location-integrity.spec.mjs`, now 11 cases. Release ID bumped to `2026.10.09.494` in release.js/README.
- Laravel MASTER remains untouched; restored nearest saved 100m behavior from .493 remains in place.

Verification:
- Targeted `npm run test:delivery-location-integrity` 11/11 PASS.
- Full `npm run test:react-parity` PASS, `npm run build:react` and postbuild generated contract PASS. Build main asset `/react/assets/index-D8_RhRxF.js`. `git diff --check` PASS.
- Browser smoke on Mac: installed Chrome with a mock Google Maps API (fake Map + Marker DOM that records placement, visibility and zoom) against built app served locally. **Desktop 1280px and Mobile 440px** both PASS: closer Saved Address B initially auto-selected over default A, pin rendered at B and zoom 16; explicit selecting A moves pin to A; clicking a different spot moves pin and clears unrelated Saved Address selection/address label. This confirms React->Google Maps marker lifecycle, not the real user's own GPS/device or live Google Maps tiles.
- Before fix, Chrome diagnostic on .493 production showed selected numeric coordinates and Google Maps initialized at fallback zoom 11 while marker could remain hidden due to map/prop load race. Real Google Maps tiles were reachable.
- No authenticated customer profile data or live Delivery orders/payments modified. Only Hosting deployment is planned; no Functions/Rules, main merge, or Vite bundle deletion.

Status at this worklog entry: Git implementation commit/push and Firebase Hosting release pending. Update after deploy and production verification. Real Android/iPhone Google Maps pin verification still required.

### 2026-10-09 — Google Maps lite/static runtime marker omission follow-up (Build .495)

During post-release verification of Build .494 against **real Production Google Maps**, Chrome rendered `#deliveryLocationMap` using a small static/lite `StaticMapService.GetMapImage` renderer; the map was initialized and the selected Saved Address coordinates appeared, but there was no classic `.gm-style` map layer/marker DOM to show the pin reliably. The earlier simulated Map/Marker-only smoke had passed but did not cover this renderer. A check waiting for `.gm-style` timed out; a later read-only diagnostic confirmed `window.google.maps.Map` was ready and the map HTML existed, so this was not an overall app/map loading failure.

Corrective Build .495:
- Added `react-app/src/utils/mapPinProjection.js`: pure Web Mercator zoom projection of saved customer latitude/longitude into pixel offsets relative to the current Google Maps viewport centre, with valid-size guards and world wrap.
- `DeliveryLocationPicker.jsx`: independent visible location pin overlay (`delivery-location-visible-pin`) in the map stage. The overlay is tied to the **exact saved location**, not a decorative fixed-centre pin. It uses `map.getCenter()/getZoom()`, refreshes on center/zoom/idle events, and hides if point moves outside the viewport or is invalid. Google Maps native marker remains available for drag, while independent pin covers lite renderer failures. Existing load-race repair and latest React callback were preserved. CSS in `delivery-location-map.css` renders high-contrast semantic map-pin icon; overlay pointer-events:none so map remains interactive.
- Targeted test added for map projection, pan direction, invalid dimensions, antimeridian and overlay-map lifecycle; all languages were already translated in .494.
- Release Build incremented from .494 to **2026.10.09.495** (Version 0.4.280 retained).

Verification:
- `npm run test:delivery-location-integrity`: **12/12 PASS**.
- `npm run test:operational`, full `npm run test:react-parity`, `npm run build:react`/generated build contract: PASS. Built bundle `/react/assets/index-BGHWZobX.js`. `git diff --check`: PASS.
- Mac Chrome local compiled-app guest-mode browser smoke with controlled map renderer (no production writes): Desktop width 1280 and Mobile width 440 both **showed the independent pin** at Saved Address B: PC x177/y159 in 354x318 map; Mobile x177/y139 in 354x278 map. Simulated map pan east shifted pin left from x177 to x174.67 (coordinates remain pinned, not screen-centred). Both PASS.
- Still require verification on real Google Maps mobile user agent and an actual physical device, since browser/device GPS and static map tile mode can differ.

Safety: no user profiles or orders modified, no Cloud Functions, Firestore Rules or Storage Rules changed; no main merge and no deletion of historic unhashed bundles. Git commit/push and Firebase Hosting release pending at entry creation; update after release.

### Build .496 — Prevent pin from appearing before Google Maps projection is ready

Post-.495 Production smoke with real Google Maps identified that the overlay was briefly visible at the top-left before map tiles/API finished initialization: React changed `hidden={!normalized}` to false as soon as customer coordinates arrived, while no pixel position had been calculated. Google Maps could still be in a loading/empty state. This was not acceptable for a location picker.

- `DeliveryLocationPicker.jsx`: keep the overlay hidden until **both** a valid saved coordinate and `mapState==="ready"` exist. `syncVisiblePin` explicitly sets `style.visibility="visible"` only after a valid pixel location is calculated; invalid, unready, unloaded and out-of-viewport states remain hidden. Cleanup also hides the overlay.
- `delivery-location-map.css`: overlay defaults to `visibility:hidden` to avoid first-paint flash regardless of React scheduling.
- Targeted regression now checks the hidden-before-ready invariant. Build **2026.10.09.496**, asset `/react/assets/index-C7iJdWGI.js`.
- `npm run test:delivery-location-integrity` 12/12 PASS, full React parity PASS (before last focused assertion; last assertion rerun PASS), `npm run build:react`/build contract PASS, `git diff --check` PASS.
- Git commit/push and Hosting Production release pending. No Functions/Firestore/Storage rules, order/customer writes or main merge.

### Build .496 — Production deployment verification

- Implementation commit 5de1b27f pushed to feature/react-firebase-port. Firebase Hosting foodapp deployed successfully to https://penguin-food.web.app, project chat-45754. No Functions, Rules, customer or tenant data changed.
- After deployment, real Production Google Maps JavaScript was tested with Chrome and an isolated guest fixture and emulated geolocation, without creating any order: PC 1280 and mobile 440 selected the nearest Saved Address B at 13.8298600, 100.6421000, loaded Google map content and displayed the independent map pin correctly. PC pin measured x159 y116 within 356x320; mobile x159 y96 within 356x280. Browser test passed both.
- Existing regression 12/12, full React parity, operational test and generated build contract passed. Build 2026.10.09.496, bundle index-C7iJdWGI.js.
- Real customer devices and physical GPS accuracy still require user confirmation. No main merge, no cleanup of historical bundles.

## 2026-10-09 — Weekly Delivery opening days/hours and immediate emergency closure (Build .497)

Request: Tenant store owners/admins want opening weekdays (Mon–Sun), different opening/closing time per weekday, and immediate manual open/close for repairs or emergencies. Delivery customers must see "store closed" and cannot place new orders outside allowed hours.

Implementation:
- Data model in existing tenant settings document (no backfill): `deliveryHours: {enabled, days:[{day,enabled,open,close}]}` and independent `deliveryManualStatus: {mode:'auto'|'open'|'closed',reason,until}`. Each day has its own HH:MM open/close; overnight shifts accepted. Thailand timezone Asia/Bangkok used for all comparisons, not browser local timezone. Empty until means stay manually open/closed until toggled; optional until uses Bangkok-local YYYY-MM-DDTHH:MM and expires automatically into weekly schedule.
- Crucial legacy-safe default: where store has no `deliveryHours.enabled=true`, Delivery stays open 24/7 as before. No tenant data written automatically by build/deploy; owner must explicitly activate schedule and click Save Settings.
- Admin `/admin` Settings now includes `DeliveryHoursEditor` for 7 daily rows (enable, opens, closes) with direct buttons "Open now", "Close now", "Use normal schedule" and customer-facing closure reason + optional expiration. Buttons save just the independent override immediately to `tenants/{tenantId}/settings/store` without waiting for weekly settings Save; full Store Settings save persists only the schedule and verifies it after read-back. CSS `admin-opening-hours.css` responsive; all five locale dictionaries updated.
- `deliveryOpeningHours.js` handles Bangkok day/time, overnight boundary, manual forced open, manual forced close, until expiration and legacy default.
- Customer Delivery subscribes to live store settings with Firestore `onSnapshot`, ticks every 15 seconds for scheduled transitions, waits for first live setting state before rendering and uses a prominent close banner at top with message/reason. When closed, menu add/quantity-increase and Submit buttons are disabled, and submit handler checks status.
- Safety: `checkDeliveryStoreIsOpen` does an uncached Firestore server read before payment lock / payment-related steps. `createPublicDeliveryOrder` uses a Firestore client transaction: read tenant's store settings and verify open **inside the same transaction** before writing an order. Thus a closure that updates the settings document during an in-flight transaction retries and rejects at write time. It does not change any existing orders.
- Scope deliberately limited to restaurant Delivery (self and Lalamove); no changes to Table, Takeaway, Retail POS. No Firebase Functions or Firestore/Storage Rules were modified or deployed. Security caveat: while client transaction protects normal app use and races, an untrusted custom SDK caller can bypass this unless Firestore Rules/server-side order creation enforces shop hours; this requires separately authorized backend rollout.
- Test file `tests/react-parity/delivery-opening-hours.spec.mjs`, wired into `npm run test:react-parity`: 10 cases covering legacy compatibility, Bangkok timezone, weekday/open/close boundaries, overnight shifts, manual overrides/expiry, both Admin interfaces, closed Delivery UI and transaction guard, five languages. Tests **10/10 PASS**. `npm run test:operational`, full `npm run test:react-parity`, `npm run build:react` + generated contract PASS. React Build **2026.10.09.497**, asset `/react/assets/index-xdqGCsHK.js`. `git diff --check` PASS.
- Chrome CSS responsive check at widths 320/390/440/768/1366px: seven day rows, no horizontal overflow and immediate action buttons >=41px height, all PASS. Static layout check, not authenticated Admin account E2E. Did not write real tenant store settings or perform a production payment/order.
- Scope release: Firebase Hosting foodapp only, preserve old Vite bundles and branch, do not merge main. Git commit/push and Hosting deployment pending at checkpoint; verify live bundle before claiming live.

### Build .497 — Production Hosting confirmed

- Commit dcdb1325 pushed to feature/react-firebase-port and synced 0/0. Firebase Hosting foodapp (project chat-45754) deployed successfully to https://penguin-food.web.app. No Cloud Functions, Firestore/Storage Rules, account settings, customer profiles, orders, or payments were changed in the deployment.
- Live canonical /admin, /s/saas-test-shop/delivery, /delivery, /cashier and /kitchen all HTTP 200 referencing /react/assets/index-xdqGCsHK.js. Live React JS, new Firebase runtime chunk /react/assets/firebase-IqF1EeP8.js, admin-opening-hours.css and delivery-location-map.css all byte-identical to Mac build. Old Build .496 JS remains available.
- Read-only Chrome Production smoke: Delivery PC 1280 and Mobile 390 both loaded store heading, cart and Submit button without errors. On test tenant without new scheduling enabled, no forced closure banner appeared (legacy remains open). No orders, store overrides or payment tests against actual production tenant.
- Opening-hours pure checks 10/10 PASS; existing operational/React parity and build contract PASS. Chrome static admin scheduling layout 320, 390, 440, 768 and 1366px PASS without horizontal overflow. Real authorized Admin save and immediate close/reopen E2E with a tenant account remain acceptance tests.
- Security limitation remains: normal customer client uses up-to-date server read and atomic settings+order transaction, but Firestore Rules themselves were not modified. Arbitrary direct SDK clients need rule/server-side enforcement in a separately authorized backend release.

## 2026-10-09 — Backend-enforced Delivery store closures / secure order submission (Build .498)

User authorized closing the remaining loophole: direct Firestore REST/client SDK could create public Delivery orders even while store was manually/schedule closed in React Build .497.

Investigation:
- Existing rules `firestore.rules` allowed direct creation under both legacy root `/orders/{orderId}` and tenant `/tenants/{tenantId}/orders/{orderId}` from public clients. Public React-side checking and a client runTransaction were insufficient against manually crafted API requests.
- Identified `createPublicDeliveryOrder` as the only React Delivery create path; Table and Takeaway have their own direct Firestore paths. React checkout uses guest access; cannot require a signed-in user for all Delivery.
- Production Cloud Functions node22, asia-southeast1. No frontend App Check configured. Firebase Firestore Emulator cannot run on current authorized Mac without installing a Java runtime, so static/rule-structure tests and Firebase deploy compiler will be used; do not claim emulator e2e was performed.

Implementation:
- New Cloud Function `submitPublicDeliveryOrder` at `functions/public-delivery-submit.js` exported via `functions/index.js`. Validates tenant ID, checkout payload size/field allowlist, items, totals, recipient, pinned coords, delivery provider, payment method and Slip2Go preverified path for PromptPay. Rejects client-supplied audit fields and forces orderType, status, paymentStatus, tenant/shop IDs and server timestamps. No duplicate ID overwrites.
- Within Admin SDK Firestore transaction read tenant, `settings/store` and target order; validate restaurant business availability, calculate official hours in **Asia/Bangkok** with fresh server clock and `deliveryManualStatus` override, reject closed/unavailable. Transaction retries if store settings change before commit; no writes for rejected orders. New pure server `functions/delivery-opening-hours.js` mirrors frontend policy with tests proving schedule parity, including overnight shifts and override expiry. No tenant setting migration.
- `react-app/src/data/publicStorefrontData.js`: replace direct client write transaction with `httpsCallable('submitPublicDeliveryOrder')` after existing freeGift normalization; preserve checkout return shape, clearing draft ID only after success. Existing Slip2Go, Lalamove, COD and checkout UI intact. Delivery page distinguishes backend errors from payment Slip2Go service error and surfaces "ร้านปิด" text on server refusal.
- `firestore.rules`: all public Firestore client direct `orderType=delivery` creates blocked at both root and tenant paths, **including super_admin branch**; existing Table and Takeaway creates remain permitted. Also prevent updating an existing non-delivery order's type to delivery (morph). Only server Admin SDK creates new Delivery; backend enforces closure against custom external API clients.
- Regression `tests/react-parity/delivery-server-guard.spec.mjs`, 7/7 PASS: server/browser Bangkok policy parity, malformed/forged fields, open order create, closed reject/no write, disallowed tenant/duplicate, both rules paths and non-Delivery paths, callable/export. Added to full `test:react-parity`; updated old opening-hours test from client transaction to backend transaction.
- Build **2026.10.09.498** new frontend asset `/react/assets/index-CNsdruuu.js`. Full React Parity PASS, Operational PASS, Vite/Postbuild PASS and Node syntax check of Functions PASS, `git diff --check` PASS. Java-based Firestore Emulator not runnable on this Mac; Rules compiler validation on deploy planned.
- Rollout order **Functions:submitPublicDeliveryOrder first**, then **Hosting:foodapp** Build .498, then **firestore:rules** only once new function and frontend are verified. Do not deploy all other Functions, do not change Storage Rules, customer records or existing orders, do not merge main/reset/delete untracked old hashed bundles.
- Security limitation: guest checkout must remain callable while store is open. Endpoint is public and this task enforces store closure; it is not an App Check/rate-limiting or full pricing/payment integrity rewrite. App Check would need explicit configuration, otherwise could break guest checkout.
- Pending at entry creation: Git commit/push, staged deploys and live verification. Update when done.

### Build .498 — Staged Production rollout completed; Rules cleanup

- Implementation commit `728a6eb7 security: enforce Delivery store hours in backend and deny direct writes` pushed to `origin/feature/react-firebase-port` (0/0). No merge into main; all legacy/untracked Vite hashed bundles preserved.
- **Stage 1 — Cloud Functions:** `functions:submitPublicDeliveryOrder` successfully created as Node.js 22 second generation, `asia-southeast1`, via selective Firebase deploy (no other Functions redeployed). Read-only invalid-input POST to live Callable URL returned HTTP 400 JSON `INVALID_ARGUMENT / DELIVERY_ORDER_INVALID`, no Firestore writes.
- **Stage 2 — Firebase Hosting:** `hosting:foodapp` deployed to `https://penguin-food.web.app` successfully (561 public files). Production `/admin`, `/s/saas-test-shop/delivery`, `/delivery`, `/cashier`, `/kitchen` HTTP 200 and referenced Build `2026.10.09.498` `/react/assets/index-CNsdruuu.js`; live JS byte-identical to Mac and shared Firebase chunk present.
- **Stage 3 — Firestore Rules:** `firestore:rules` compiled successfully and released, disallowing *all direct client* Delivery order creations at root and tenant paths, including authenticated super-admin. Non-Delivery Table/Takeaway creates still use their existing permissions. Also prevents update-based conversion to a Delivery order. No Storage Rules deployment, tenant settings writes, customer data mutation, or live order/payment test.
- Firestore compiler issued warnings for two old unused functions `validDeliveryOrder`, `validPublicTenantDelivery`, one containing obsolete `request` refs. Removed **only these unreachable direct-client authorizers** after successful original Rules release. Reran targeted Security 7/7 and full React parity PASS. Rules redeploy to remove compiler warnings pending when this note was written.
- Test environment caveat: Java runtime absent on Mac, so Firestore Emulator cannot run. Rule compilation and successful release confirmed by Firebase CLI. This verifies server-enforced closure in the normal and direct SDK paths, but does not replace a true live authenticated end-to-end checkout acceptance test or complete anti-spam/payment anti-fraud hardening; anonymous guest ordering remains allowed **while store is open**, through validated Cloud Function only.

### Build .498 — Clean Rules redeploy and final live verification CONFIRMED

- Security cleanup commit `44d373fb` pushed to `origin/feature/react-firebase-port` (0/0). Obsolete `validDeliveryOrder` and `validPublicTenantDelivery` helpers removed from `firestore.rules`; direct Delivery create rules remain denied on root and tenant paths.
- Selective redeploy `firestore:rules` project `chat-45754` succeeded a second time, with **rules compiled successfully and no warnings**; release to cloud.firestore complete. Hosting/other Functions were NOT redeployed in this cleanup.
- Read-only live public Cloud Function probe with a structurally valid COD payload targeting guaranteed nonexistent tenant `tenant-guard-probe-00000`: HTTP **404**, `NOT_FOUND / DELIVERY_STORE_STATUS_UNAVAILABLE` from Firestore transaction, and **no order created**. Proves live Admin SDK can read Firestore and reject without writing.
- Read-only Chrome production smoke **after Rules release**: Delivery at 390px and 1280px loaded shop heading, cart and submit UI without page errors, PASS. No real customer order, tenant schedule mutation, or payment writes in testing.
- Security test 7/7, opening hours 10/10, full React Parity/Operational/build all PASS. Final build `2026.10.09.498`, asset `index-CNsdruuu.js` live and byte-identical. Other channels retain their rules.
- Remaining acceptance: one authorized end-to-end real store COD/PromptPay checkout and manually close/open store confirmation (requires actual store data); Firestore emulator unavailable without Java. Do not claim App Check, rate limiting or payment anti-fraud is solved by this store hours-only change.


## 2026-10-09 — Opening-hours UI toggle + full weekday names (Build .499)

User requested, based on /admin screenshot, replacing separate Open Now and Close Now actions with one toggle switch at the top-right of the immediate store-opening header, next to the Restore Normal Schedule action. Each Monday–Sunday should use the full translated weekday name.

Changes:
- React DeliveryHoursEditor: a controlled accessible checkbox role=switch uses the persisted effective opening status, not an unsaved weekly draft, and calls the existing immediate Firestore save callback with mode=open or mode=closed, reason, and optional end time. Restore Normal Schedule button shares the same header row; on narrow screens it displays a concise label. No underlying stored IDs, settings fields, weekly hours, closure policy or backend endpoints changed.
- CSS admin-opening-hours: green/grey toggle with check/x icon, keyboard focus indicator, busy/disabled state; single header row from mobile 320px to desktop; full names fit weekly hours table without overflow.
- i18n parity-translations: full weekday names in Thai, English, Burmese, Lao, Khmer; switch status and short normal-schedule labels added.
- Opening-hours regression test checks semantic switch and callback mode, retired buttons, complete translations and full weekday names. Release Build incremented to 2026.10.09.499; generated JS /react/assets/index-Cfuu91Og.js.

Verification:
- Focused opening hours 10/10 PASS; server guard 7/7 PASS; Operational and full React parity PASS; Vite Build/postbuild PASS; git diff --check PASS.
- Chrome ran actual DeliveryHoursEditor via temporary local Vite fixture: widths 320, 390, 440, 768 and 1366 for Thai/English plus Burmese/Lao/Khmer at 440. Same-row header, no horizontal overflow and correct full weekday names PASS. At widths 320 and 1366 toggled Closed -> Open -> Normal Schedule, verified save-callback modes and preserved reason, PASS.
- Removed only temporary preview fixtures and stopped preview server. No tenant settings/order/payment data modified. Hosting-only release; no Functions/Rules changes, no main merge or removal of old hashed assets. Commit/push and Hosting deploy pending at entry creation.


### Build .499 — Production Hosting release verified

- Implementation commit 604e61c8 pushed successfully to origin/feature/react-firebase-port with 0/0 ahead/behind. Firebase Hosting only (hosting:foodapp, project chat-45754) successfully finalized/released to https://penguin-food.web.app, 562 files; no Cloud Function, Firestore or Storage Rules deploy or data mutation.
- HTTP Production verification: /admin, /delivery, /s/saas-test-shop/delivery, /cashier, /kitchen all HTTP 200 referencing /react/assets/index-Cfuu91Og.js, exactly matching local Build .499.
- Live main JS bundle, /react/parity/css/admin-opening-hours.css, and shared Firebase chunk firebase-IqF1EeP8.js byte-identical to the Mac build. No old assets removed.
- Real DeliveryHoursEditor interaction was tested in a local Chrome preview at 320–1366 widths in five languages. An authenticated Production Admin account was not used to toggle a real tenant; no claims of production tenant-setting write test.
- Handoff updated after release. No merge main, reset, clean or discard of existing untracked Vite bundles.

## 2026-10-09 — Delivery saved-address-only GPS radius, map & closed banner (Build .500)

User corrections:
- If any saved address exists (even only ONE/default) but device GPS is not within 100m of it, **NEVER auto-select that address**. Instead show notice asking customer to explicitly choose a saved address or create/save a new one. If multiple addresses and one is within 100m, auto-select closest. If no saved addresses, no delivery order. If GPS denied/coarse/unavailable, NEVER auto-select default; explicitly choose/save. Saved address and its persisted GPS point are the only delivery destination; GPS alone or a map click cannot create an unsaved checkout destination.
- Previous requests in same sequence: modernize closed-store alert; keep only native Google Maps marker (remove redundant green marker); remove "I confirmed the map pin" card, state and validation entirely.

Implementation:
- DeliveryPage.jsx: initial saved-address load then accurate fresh GPS; matchGpsSavedAddress within <=100m only; remove fallback to default saved or raw GPS destination. Explicit saved selection and saved pin are required; none/far/unavailable show locale-specific selection notice and Add Address action. Add address flow still saves its own independent map pin and selects successfully saved record. Checkout map and address text read-only from saved address. Checkout submit validation enforces existing selected saved ID, valid persisted pin, same exact coordinates and address, and no open address editor; no checkbox confirmation. Clear obsolete selection and pin if selected address is deleted/invalid. Store closed status and server order guards unchanged.
- DeliveryLocationPicker.jsx: remove independent green pin overlay, its projection callbacks and DOM; leave native Google Maps Marker, with checkout map read-only and no misleading "Use current location" control, while saved-address editor retains GPS and pin editing. Removed only the now-orphaned mapPinProjection.js utility, not any old hashed build bundles.
- delivery-location-map.css: removed green pin and confirmation card styles, redesigned closed-store banner with icon tile, hierarchy, badge and reason; added amber notice for missing/far/unavailable address and explicit Add Address action, responsive.
- parity-translations.json: new notices and saved-only map instructions, closed badge text in TH/EN/MY/LO/KM; release.js + README Build 2026.10.09.500.
- Updated tools/react-foundation-contract.mjs; location integrity regression suite now 12/12 PASS, including single far default address, multiple nearest, zero saved, denied/coarse GPS, exclusive Google marker, no old checkbox, no free-form checkout GPS, saved selection enforcement, and translations. Opening hours 10/10 PASS, Server guard 7/7 PASS, full React Parity and operational suite PASS; Vite generated build contract PASS, bundle /react/assets/index-a0X6jxym.js; git diff --check PASS.
- Installed Chrome smoke via local compiled Build .500 (no live order/payment/tenant edits), using isolated localStorage profile fixture + simulated GPS: PC 1280 single far address leaves radio blank and submit disabled; mobile 390 same, then explicit radio selection loads saved coordinates; mobile 440 single nearby auto-selects; PC multiple saved selects closer nondefault; mobile zero addresses blocks checkout but Add Address opens editor; mobile GPS denied remains unselected. All 6 scenario checks PASS. In all: no green overlay, no confirmation checkbox; checkout address readOnly; absent selected pin means no checkout map.
- Backend note: guest addresses are stored in browser local data, so the Saved Address membership rule is enforced in the React checkout (the current guest-capable Cloud Function cannot independently verify a guest's local address book). Backend's store-hours security guard remains in place. No Cloud Functions or Firestore Rules changed or redeployed in this UI-only release.
- Branch feature/react-firebase-port, preserve historical untracked hashed assets, no reset/clean/discard, no main merge. Commit/push, Firebase Hosting release and post-release verification pending as of this worklog entry.

### Build .500 — Hosting Production verification CONFIRMED

- Implementation commit `b318bae9 fix: require explicit saved address outside GPS matching radius` pushed to `origin/feature/react-firebase-port`; synced ahead/behind 0/0.
- Firebase Hosting only `hosting:foodapp` (project `chat-45754`) deployed successfully to `https://penguin-food.web.app`, 563 public files. No Cloud Functions or Firestore/Storage Rules deployed, no tenant/customer writes, no existing order/payment mutations, no main merge. Previous .499 bundle preserved.
- Live `/admin`, `/delivery`, `/s/saas-test-shop/delivery`, `/cashier`, `/kitchen` HTTP 200 with `/react/assets/index-a0X6jxym.js`, byte-identical to built Mac copy. Live delivery-location-map.css also byte-identical.
- **Post-deploy real Chrome Production read-only acceptance using isolated browser guest profiles and emulated fresh GPS**, without placing orders:
  - PC 1280 **ONE saved default, GPS far >100m**: none selected, explicit selection notice, no checkout map/pin, submit disabled — PASS.
  - Mobile 390 same single far saved address: same PASS.
  - PC 1280 with two saved addresses and GPS near non-default second: second automatically selected, checkout map available — PASS.
  - Mobile 390 with no saved addresses: none selected, notice, submit disabled — PASS.
  - Mobile 440 GPS permission denied with two saved addresses: none selected, notice, submit disabled — PASS.
  - All five had no duplicated green marker, no old pin-confirm checkbox, checkout delivery address read-only and no runtime page errors. Before release, Mac local Chrome also confirmed explicit manual choice of a far saved address loads that saved coordinate, and Add Address opens separate editor.
- Focused location regressions 12/12, opening-hours 10/10, server guard 7/7, full React Parity/Operational, build/contract and git diff check all PASS.
- Physical-device geolocation, signed-in customer's actual saved address book and authenticated order payment remain manual acceptance. Guest profile is locally persisted; saved membership enforcement remains frontend only, distinct from existing server-side store-hours enforcement.

## 2026-10-09 — Compact Delivery address cards, primary home control and spacious editor (Build .501)

User supplied PC/Mobile Chrome screenshots of /s/saas-test-shop/delivery and requested UI-only:
1. "เพิ่มที่อยู่" button on same row as "ที่อยู่จัดส่งของฉัน" on all devices;
2. saved address cards show only short address label, not recipient and full address (details only when editing);
3. remove long "ตั้งเป็นหลัก" button; use individually clickable home icon at each card's upper-right; exactly one primary saved address at a time;
4. redesign narrow/squashed address entry form/map to use much more of the available viewport and adapt all screen sizes.

Implementation:
- `react-app/src/pages/DeliveryPage.jsx`: header title/count/helper and Add aligned on same line. Compact selectable radio card contains only label and two smaller edit/delete actions; standalone top-right house/house-fill button with aria-pressed, title, disabled-state and semantic accessibility. `makeDefault` persists an exclusive default using existing `saveDeliveryCustomerProfile` and prevents duplicate requests; saving/editing/deleting normalizes exactly one default, including legacy profiles with multiple/zero default flags. Setting a primary address **does not automatically change the delivery address currently selected**; existing 100m GPS matching logic unchanged. Removed duplicate "set as default" editor checkbox; only home icon controls primary.
- Editing or adding opens `createPortal` accessible dialog with fixed header, wide independently scrolling content, visible validation/error messaging, keyboard Escape close, background scrolling locked and fixed footer actions; expands to nearly full mobile viewport and max 700px width on desktop. Recipient/label/details input and saved-pin Google map stay in this dedicated editor and save in existing guest/Google profile path. No street/recipient details rendered inside the compact cards; selecting a saved address still populates read-only delivery address below for checkout.
- CSS `react-app/public/parity/css/delivery-addresses.css` now keeps heading+Add same row even at 320px, styles short cards and home icon states, and gives edit dialog responsive full-width map and fields. Existing Google Marker/no-green-duplicate behavior, 100m GPS selection, payment rules and business-hours rules untouched.
- Release Build **2026.10.09.501**, bundle `/react/assets/index-CbV5hfUt.js`, README updated. `package.json` includes `test:delivery-address-book-ui`; new `tests/react-parity/delivery-address-book-ui.spec.mjs` 5/5 PASS, added to full React parity; Playwright `delivery-parity.spec.mjs` updated to use home icon and seed accurate GPS inside 100m.
- Validation: React Parity PASS, Delivery GPS location regression 12/12, operational contracts PASS, Build/Postbuild contract PASS and git diff --check PASS. Actual compiled React UI tested with headless installed Chrome in 320/360/390/440/768/1280px: header + Add single row, short cards ~99px (111px at 320 with long label), exactly one home icon primary persisted to guest address book, wide modal 308–700px with map 270–626px wide and >=342px tall, no horizontal overflow, form error visible, Escape closes — all PASS. Separate Chrome mobile 390 test modified existing guest address and added a new saved address with a GPS-derived map pin; data persisted in test browser storage and default stayed unique. No real customer order/payment/profile modified.
- Hosting-only deployment targeted; do not deploy Functions/Firestore/Storage Rules, do not merge main, reset/clean/discard changes or delete older untracked hashed assets. Commit/Push and production smoke pending at this checkpoint.

### Build .501 — Firebase Hosting production release verified

- Feature commit `ffbf5138 ui: compact delivery address cards and expand saved address editor` pushed to origin/feature/react-firebase-port with ahead/behind 0/0. Selective `firebase-tools deploy --only hosting:foodapp --project chat-45754` successful to https://penguin-food.web.app (564 files); **no Cloud Functions, Firestore/Storage Rules or real customer/order/payment records modified**.
- Live canonical /s/saas-test-shop/delivery, /delivery, /admin, /cashier and /kitchen served HTTP 200 referencing /react/assets/index-CbV5hfUt.js. The live JS and /react/parity/css/delivery-addresses.css were byte-identical to the Mac build. Prior .500 JS bundle remains accessible.
- Installed Chrome read-only production acceptance in *isolated browser guest-profile fixtures* (no production account writes):
  - Mobile width 390: heading and Add same row; two compact cards each 99px tall, no address details on cards; exactly one pressed house icon after clicking secondary, local guest profile persisted exactly one default; Add/Edit opened modal 378px wide and Google map container 322px wide, 360px tall; no horizontal overflow or page errors, PASS.
  - PC width 1280: same contract; modal 700px wide, map 626px wide, 342px tall, PASS.
- Local compiled Chrome earlier also passed 320, 360, 390, 440, 768 and 1280, including inline form validation, modal Escape, editable data. Persisted guest address edit and new pinned-address creation PASS. Focused UI static tests 5/5 PASS; 100m GPS 12/12, other parity / operational / build contract PASS.
- Scope: UI and address-book normalization only; 100m location selection and native Google marker behavior remain intact. Real authenticated customer/GPS and order acceptance still require normal user verification. Documentation sync commit pending at this entry.

## 2026-10-09 — Address cards radio, modal icon proportions and broken iPhone map header repaired (Build .502)

User provided three Chrome screenshots after Build .501:
1. Saved address card radio showed a square outline around circular browser input; card/button spacing needed polish.
2. PC address editor header map-pin glyph was disproportionately large inside icon tile; close icon/control was misproportioned.
3. iPhone 16 Pro Max responsive emulator (440px viewport / 75% zoom) address modal map header compressed into thin vertical text, full-width GPS button overlapped the title, and map editor was barely usable. User explicitly directed us to fix code by default, without confirmation.

Root cause found with actual installed Chrome computed DOM geometry for old Build .501: on mobile 440px `#addressForm .delivery-location-head` stayed `flex-direction: row` while inherited selector `.delivery-location-picker .delivery-location-head > .btn` imposed `width: 100%`. This consumed the entire 372px row and shrank the text element to **0px**. At 320px legacy column layout prevented it, explaining viewport-specific regression. `.app-icon` global icon multiplier expanded map pin glyph to ~32.8px in a 38/43px tile; close icon to ~21px in a 38px button. Native input appearance + older general input decoration caused the boxed radio display.

Fix: Scoped overrides in `react-app/public/parity/css/delivery-addresses.css` only (no backend/Firestore changes). Cards now have cleaner selection/highlight and soft edit/remove buttons. Radio is explicit circle with `appearance:none`, `border-radius:50%`, 20px checked radial fill and visible keyboard focus. Home button style refined without altering exclusive-default logic. Dialog pin tile/glyph 40/18px desktop and 36/17px mobile, close control/icon 38/15px, both visibly centered and keyboard accessible. Scoped map header uses desktop two-column CSS grid, and on mobile (<641px) **single-column grid** for title/help above an independent full-width GPS button; help wraps normally instead of collapsing or truncating. Editor occupies full viewport on mobile with safe scrollable body and sticky footer; map height 240–300px and text/map UI are readable. CSS changes are limited to address editor/card scope and preserve Google native marker and saved-address-only GPS within 100m.

Tests: Added 3 focused regression cases to `tests/react-parity/delivery-address-book-ui.spec.mjs` (now 8/8 PASS) for radio circle, centered modal icons and responsive map-header grid. `npm run test:operational`, full `npm run test:react-parity`, `npm run build:react` (generated build contract), `git diff --check` all PASS. Release Build `2026.10.09.502`, bundle `/react/assets/index-dsgwEW43.js` with Version 0.4.280 unchanged.

Actual compiled local Build .502 was exercised via installed Chrome headless with isolated test guest profile and GPS on widths 320/360/390/440/768/1280px. Every viewport PASS: computed radio `appearance:none`, 50% round and no box shadow; icon glyph-centre error exactly 0px X/Y for both pin and close; icon glyph size <20px. At <=440px title and helper width 278–384px and the full-width GPS control appears on its own following row (height 43–44px); desktop >640px uses two-column title/GPS button layout. Modal body scrolls, editor map >=300px high mobile, 325px desktop, footer remains within modal. Modal missing-address validation and cancel/close flow PASS, no page errors or horizontal overflow. No production tenant settings/orders/payments mutated.

Scope/release: Branch `feature/react-firebase-port`, preserve untracked earlier hashed assets, never merge main/reset/clean. Commit/push, Firebase Hosting-only deploy and Production smoke are pending as of this note; update after release verification. Cloud Functions/Firestore/Storage Rules unchanged.

### Build .502 — Firebase Hosting Production verification complete

- Feature commit `a6a912b2 fix: restore usable mobile delivery address map and polish controls` pushed to `origin/feature/react-firebase-port`, synced 0/0. Firebase Hosting-only `hosting:foodapp` deployed successfully to `https://penguin-food.web.app` (565 public files). No Cloud Functions, Firestore/Storage Rules, or real tenant/customer/order/payment data changed. No main merge/reset/clean or previous hashed assets deleted.
- Production HTTP checks: /s/saas-test-shop/delivery, /delivery, /admin, /cashier, /kitchen all HTTP 200 referencing the new `/react/assets/index-dsgwEW43.js`; live JS and `/react/parity/css/delivery-addresses.css` byte-identical to Mac. Prior Build .501 bundle still accessible.
- Actual installed Chrome **against production** with isolated local guest profile + simulated GPS: widths 320px, 440px (reported broken iPhone 16 Pro Max case) and 1280px PASS. Native address radio computed `appearance:none`, round 50% and no square/shadow. Both location-pin and modal-close glyph center deltas exactly **0px** on X/Y. Mobile map-title widths 278px/384px (previously 0px at 440), GPS button in following full-width row and functioning; 1280px retains separate right-side GPS action. No horizontal overflow or JS page errors. Clicking modal GPS set expected coordinates; cancel closed without mutation.
- Before deploy local Chrome checked 320/360/390/440/768/1280px and all passed. Targeted address-book UI tests 8/8, Operational, full React Parity, React build/postbuild PASS.
- Remaining user acceptance: visual review on real iPhone/Safari and real customer Google Maps location after refreshing cached Build. The production Chrome tests did not create customer records, process payments, or place orders.

## 2026-10-09 — Delivery floating favorite-style Home icon & saved map help text wrap (Build .503)

User supplied iPhone 16 Pro Max 440px screenshot and requested: (1) replace large outlined boxed Home default-address button with the same floating borderless icon look as product favorite heart, and (2) fix overflow of long text under "ตำแหน่งจัดส่ง" in the read-only saved address Google map card. Requested direct fixes on Mac without repeated clarification.

Root cause: favorite heart CSS in `react-app/public/parity/css/delivery-favorites.css` uses an absolute transparent 26px icon-only overlay, while Home in `delivery-addresses.css` was a boxed 38px grid item. Separately, the read-only checkout map description used a global `.menu-category {white-space:nowrap}` and at mobile 440px its content stretched to 473.8px while the card map heading had 356px available, overflow visible beyond card. At 320px it stretched to 473.8px against a 236px heading (verified with Chrome DOM geometry). The address-editor map header was already independently fixed and must not be regressed.

Implementation:
- `react-app/public/parity/css/delivery-addresses.css`: scope default Home control to `body.delivery-page .address-list`; float at top-right (8px inset), 30x30px transparent no border/shadow like the product heart; unselected outlined house gray, selected filled house green, 18px icon and light shadow, visible focus and hover. Simplify card grid so right-side Home icon is overlaid independently, with reserved space after address title and edit/delete actions unchanged.
- `react-app/public/parity/css/delivery-location-map.css`: scope specifically to read-only `#deliveryLocationPicker`; map heading/content max width 100%, `white-space:normal`, `overflow-wrap:anywhere`, natural line height and break on narrow screens; status/footer also able to wrap. Keep the separate edit dialog map, native Google Marker, saved-address-only + 100m GPS selection, one-only Home default, customer order/payment logic unchanged.
- Focused `tests/react-parity/delivery-address-book-ui.spec.mjs` extended with two new assertions (10/10 PASS) for floating borderless Home styling and wrapping saved map card description. Release bumped Build `2026.10.09.503` (Version 0.4.280 retained), README updated, generated main bundle `/react/assets/index-BjEjutke.js`.
- Tests: Operational, full React parity and Vite Build/Postbuild contract PASS; git diff --check PASS. Compiled local React app verified in installed Chrome using independent guest fixture at widths 320,360,390,440,768,1280: all PASS. Home computed absolute/transparent/no-border, 30x30px top-right inset 8px; clicking Home on second address persisted *exactly one* default without changing selected checkout destination; description wraps into 56px tall at 320 and 37px tall at 360/390/440/1280, one line 19px tall at wide 768; zero card text/horizontal page overflow, no JS errors. Local guest data only; no production writes.
- Git target: feature/react-firebase-port. Do not merge main/reset/clean or delete Vite hashed bundles. Commit/Push and Firebase Hosting-only deploy pending at worklog entry; complete Production checks then update this log. No Functions/Firestore/Storage Rules changes.

### Build .503 — Production Hosting verification completed

- Feature commit `0b09de9b ui: float saved Home like favorites and wrap checkout map description` pushed to `origin/feature/react-firebase-port` with 0/0 ahead/behind. Selective `firebase-tools deploy --only hosting:foodapp --project chat-45754 --non-interactive` succeeded to `https://penguin-food.web.app`, 566 Hosting public files. No Functions or Firestore/Storage Rules deployment, customer/profile/order/payment changes or main merge. Earlier Build .502 JS remains accessible.
- Live `/s/saas-test-shop/delivery`, `/delivery`, `/admin`, `/cashier`, `/kitchen` all HTTP 200 with `/react/assets/index-BjEjutke.js`; live JS and both CSS files `delivery-addresses.css` / `delivery-location-map.css` byte-identical to compiled Mac build.
- Installed Chrome **Production** smoke with isolated local guest profile and emulated GPS (no production records written): widths 320/440/1280px PASS. Read-only checkout saved-location help wraps naturally to 236/356/356px content widths with 56/37/37px heights, no card or page overflow. Home action is absolute floating with transparent background, 0px border, selected green. Clicking the other Home persisted exactly one primary in isolated guest profile without changing selected checkout destination. No runtime page errors. Full local browser 320/360/390/440/768/1280 and source regression 10/10, full React parity/operational/build contract PASS.
- User can refresh /s/saas-test-shop/delivery to inspect. Browser GPS was emulated for acceptance; physical-device user validation remains manual.
## 2026-10-09 — Remove redundant primary Home control from Delivery addresses (Build .504)

User accepted removing 'ตั้งเป็นที่อยู่หลัก' from customer Delivery cards. Destination is selected from accurate device GPS only when a saved pin is within 100 metres; otherwise customer chooses a saved address or saves a new one. Legacy isDefault field must remain in old records for backward compatibility; it must no longer determine checkout auto-selection or get rewritten during add/delete.

Implementation:
- react-app/src/pages/DeliveryPage.jsx: removed primaryAddressId, makeDefault() profile writes, and Home icon/button/tooltip/handler from all saved address cards. Kept radio selection and Edit/Delete controls. Removed isDefault initializer from Add Address buttons. Editing an existing saved address retains its isDefault property verbatim if present. New addresses no longer get an automatic primary marker; deleting an address does not promote another or rewrite any others. GPS radius, explicit manual selection precedence, saved-only checkout, Google map, payment and store-hours rules untouched.
- react-app/public/parity/css/delivery-addresses.css: removed 17 dead Home-button CSS rules, restored full-width card labels. Radio, compact cards, responsive modal and map rules unchanged.
- tests/react-parity/delivery-address-book-ui.spec.mjs: retired Home expectations, added no-Home and legacy-field preservation contracts; tests/react-parity/delivery-parity.spec.mjs: action icons now Edit and Delete only.
- Bumped release to 2026.10.09.504 (Version 0.4.280 retained), commit tag DELIVERY-GPS-MANUAL-ADDRESS-NO-DEFAULT, README updated.

Verification:
- Targeted address-book tests 11/11 PASS; Delivery location integrity 12/12 PASS including far saved default, nearest of many, denied GPS and saved-only checkout.
- npm run test:operational, full npm run test:react-parity (including backend security tests 7/7), React build/postbuild and git diff --check PASS. New JS bundle /react/assets/index-mpUULFMy.js.
- Installed Chrome local compiled-app smoke using isolated browser Guest profiles and emulated GPS: Mobile 320 far one address unselected/warned, Mobile 390 near several selects nearest, iPhone 440 near several selects nearest while manual override wins, Desktop 1280 near selects correct address, Mobile 390 no saved addresses blocks, Mobile 440 GPS denied blocks. No Home button in any case, no horizontal overflow. Editing old non-primary preserves its isDefault=false and old primary isDefault=true without rewriting others.
- Profile storage schema unchanged and no production account/profile/payment/order write made. No backend/Cloud Functions/Firestore Rules change, no main merge/reset/clean, no removal of old hashed Vite assets.
- Commit/push and Hosting-only deploy pending at this checkpoint; update after release verification.
### Build .504 — Firebase Hosting Production release verified

- Feature commit af90b484 ui: remove legacy default Home control from Delivery addresses pushed to origin/feature/react-firebase-port (0/0 ahead/behind). Selective firebase-tools deploy --only hosting:foodapp --project chat-45754 --non-interactive succeeded to https://penguin-food.web.app (567 Hosting files); no Cloud Functions or Firestore/Storage Rules deployment, no real customer/profile/order/payment mutation. Prior .503 hashed bundle remains accessible.
- Production HTTP checks: /s/saas-test-shop/delivery, /delivery, /admin, /cashier, /kitchen HTTP 200 referencing /react/assets/index-mpUULFMy.js; live JS and /react/parity/css/delivery-addresses.css byte-identical to local Mac build.
- Installed Chrome against live Production with isolated Guest profiles/emulated device GPS: Mobile 320 with saved address far outside radius did not auto-select and showed warning; iPhone 440 with multiple saved addresses selected the closest within 100m; PC 1280 selected closest within 100m; Mobile 390 GPS denied did not auto-select and displayed choice warning. In all cases, exactly 0 Home buttons, radio/Edit/Delete still present, no horizontal overflow or page errors; legacy isDefault true/false values remained intact in test profile.
- Local Chrome earlier also confirmed manual selection overrides GPS near-match and editing an old non-default address retains prior isDefault=false while another existing default=true is unchanged. Unit/integrity/regression tests, full React parity/operational and Vite build/postbuild passed.
- Scope intentionally UI and saved-address profile handling only; customer delivery validation and backend store-hours guard unchanged. Real logged-in Google customer acceptance on physical phone remains to be checked by user.
## 2026-10-09 — Compact single-row Delivery address cards matching user mockup (Build .505)

User provided side-by-side screenshots: real Delivery saved-address cards still used ~100px/card with a second row of large text buttons, while the desired mockup has a ~65–75px single row per card, Edit/Delete as small icon-only controls on the right, radio + name on the left, a selected-delivery caption, and a light compact Add button. User explicitly reminded the assistant to always implement changes on their Mac rather than hand off patch instructions.

Implementation:
- `react-app/src/pages/DeliveryPage.jsx`: card title and selected-only subtitle wrapped in `address-card-content`, no full street details; replaced text Edit/Delete with icon-only buttons, preserving semantic icons plus localized aria-label/title, busy/locked states and the same edit/delete handlers. Address header now shows the existing count as plain secondary text, drops the redundant help line; Add Address action unchanged except compact appearance. Selection radio and saved-address-only GPS/manual choice unchanged.
- `react-app/public/parity/css/delivery-addresses.css`: high-specificity Delivery-only overrides for single horizontal CSS grid `minmax(0,1fr) auto`, centered action icons, compact card height 62px phone / 66px PC, small light action icons with 8px spacing (6px label/action clearance only at 320px), soft selected green border and background, small Add action, smaller header/count. Dialog/Google map styles unchanged; no Home default button reintroduced.
- `react-app/src/i18n/parity-translations.json`: added selected-delivery-address caption across Thai/English/Burmese/Lao/Khmer. `tests/react-parity/delivery-address-book-ui.spec.mjs`: two new regression tests for icon-only same-row card actions and locale coverage (13/13 PASS). Release Build `2026.10.09.505`, Version 0.4.280 unchanged; README updated.
- `npm run test:delivery-address-book-ui` 13/13, `npm run test:delivery-location-integrity` 12/12, Operational, full React Parity, `npm run build:react`/generated contract and git diff --check PASS. New bundle `/react/assets/index-DFL_FfeQ.js`.
- Actual compiled React on installed Chrome against isolated local guest-profile/GPS fixtures: viewport widths **320, 360, 390, 440, 768, 1280px** ALL PASS. Cards measured 62px phone / 66px PC, centered inline action icons with nonzero spacing (6px at 320, 8px 360–440, 10px PC), selected-only subtitle, same-row header Add, no horizontal overflow or JS page errors. Confirmed Edit opens the existing address modal, Cancel closes, and manual selection overrides initial GPS selection.
- No account/profile/tenant/order/payment writes to Production in tests. Firebase Hosting only, no Cloud Functions/Firestore/Storage Rules, no main merge/reset/clean/discard/old bundle removal. Commit/push/hosting release pending at checkpoint.
### Build .505 — Firebase Hosting Production verification confirmed

- Feature commit 641ee56a (ui: compact delivery saved address cards with inline icon actions) pushed to origin/feature/react-firebase-port; ahead/behind 0/0. Firebase Hosting-only foodapp (project chat-45754) successfully released Build 2026.10.09.505, 568 public files, URL https://penguin-food.web.app. No Cloud Functions, Firestore or Storage Rules changes; no production customer data/payment/order writes.
- Live /s/saas-test-shop/delivery, /delivery, /admin, /cashier, /kitchen all HTTP 200 referencing /react/assets/index-DFL_FfeQ.js. Live main JS and delivery-addresses.css byte-identical to Mac compiled build; previous Build .504 hashed bundle remains accessible.
- Installed Chrome Production smoke in isolated Guest profiles with emulated GPS, no real writes: 320px and 440px mobile cards 62px tall; PC 1280px cards 66px. Exactly two accessible icon-only Edit/Delete controls per card; selected-only delivery subtitle and same-row Add header; no old full-width button row, no Home controls, no JS errors/overflow. Edit modal opens and closes successfully.
- Before release, full local actual React Chrome viewport verification 320/360/390/440/768/1280 confirmed action icons vertical center and manual selection overriding GPS. Focused address UI 13/13, GPS integrity 12/12, complete React parity / Operational and generated build contract PASS.
- Branch feature/react-firebase-port, main not merged, original hashed bundles retained, no reset/clean/discard. Signed-in production customer checkout and physical GPS remain manual user acceptance.## 2026-10-09 — Delivery slip text overflow and customer receipt presentation (Build .506)

User supplied iPhone 16 Pro Max screenshot showing the long Slip2Go verification guidance spilling horizontally beyond the mobile receipt/upload card. During the same task, user additionally requested these customer Delivery confirmation receipt changes: payment row for proof awaiting verification reads 'ชำระเงินแล้ว รอร้านตรวจสอบ'; zone row for Lalamove reads 'จัดส่งโดย Lalamove'; each ordered item shows 'ตำข้าวโพดไข่เค็ม x 1' inline with quantity.

Implementation:
- DeliveryPage.jsx adds only a scoped `#paymentSlipReviewNote.delivery-payment-slip-review-note` hook; payment-slip.css scopes `white-space:normal`, `overflow-wrap:anywhere`, proper block sizing/line-height and card max width to the review note, with long filename wrapping/fixed size in the preview. Existing Slip2Go upload, server verification and order/payment mutations not changed.
- DeliverySuccessPage.jsx uses pure helpers in react-app/src/utils/deliveryReceiptPresentation.js: `deliveryReceiptPaymentLabel` shows the requested pending-proof copy only for `paymentStatus=pending_verification`, while actual server state stays pending until verified; paid and COD receipts preserve their distinct labels. `deliveryReceiptZoneLabel` substitutes 'จัดส่งโดย Lalamove' only when `deliveryProvider=lalamove`, retaining original deliveryZoneLabel for store/self delivery. `deliveryReceiptItemLabel` formats item text with inline ' x <qty>' directly after product name. Receipt quantity formatting changes display only, not items or totals. Responsive receipt text CSS scoped to delivery-success-tracking.css to avoid clipping long product names.
- parity-translations.json adds the receipt Lalamove label and updates pending verification receipt wording for TH, EN, MY, LO, KM; other verify page statuses and cashier/kitchen translations unchanged. Build 2026.10.09.506 (Version 0.4.280 unchanged), README and release milestone updated.
- New regression tests `tests/react-parity/delivery-receipt-presentation.spec.mjs` 5/5 PASS (pending review vs paid vs COD, provider and self fallback, literal item format, five locales and JSX binding), included in full React parity. Existing Slip2Go flow gained two overflow tests and passed 16/16. Entire Operational / full React Parity including server guards and build/postbuild contract PASS, `git diff --check` PASS. New JS bundle `/react/assets/index-BXZfwSp3.js`.
- Installed Chrome with isolated, read-only DOM fixtures against compiled local React (NO live orders or uploads): mobile 320/360/390/440, tablet 768, desktop 1280 slip guidance and 120+ character filename all inside card, no horizontal overflow; 768 naturally one line, mobile wraps two lines. Receipt display fixture widths 320/390/440/768/1280 shows exact three requested texts and full long product name without clipping/overflow. Pure helper tests confirm paymentStatus is not changed.
- Target: Git feature/react-firebase-port, Firebase Hosting-only project chat-45754 hosting:foodapp. No Cloud Functions/Firestore/Storage Rules deployment, no real tenant/customer/order/payment writes, no main merge/reset/clean, preserve previous Vite hashed bundles.
- Commit/Push/Hosting release pending at this worklog entry; update with production verification.### Build .506 — Firebase Hosting production verification CONFIRMED

- Implementation commit `e461d32c fix: wrap mobile Delivery slip and update customer receipt labels` successfully pushed to `origin/feature/react-firebase-port` (0/0 ahead/behind). Selective `firebase-tools deploy --only hosting:foodapp --project chat-45754 --non-interactive` succeeded to https://penguin-food.web.app, 570 Hosting public files. No Cloud Functions, Firestore Rules or Storage Rules deployed; no production orders/payments/customer data mutated, no main merge, no reset/clean/discard, previous hashed JS bundles preserved.
- Live /s/saas-test-shop/delivery, /s/saas-test-shop/delivery/success, /delivery, /admin, /cashier and /kitchen all HTTP 200 referencing new `/react/assets/index-BXZfwSp3.js`. Live JS and CSS `/react/parity/css/payment-slip.css` and `/react/parity/css/delivery-success-tracking.css` byte-identical to Mac-generated build; prior Build .505 hashed bundle remains accessible.
- Installed Chrome **against production** using isolated read-only in-page DOM fixtures (not real order upload/checkout): slip guidance and long filename at viewport 320/360/390/440/768/1280 ALL PASS with no card/page overflow; receipt mock display at 320/390/440/768/1280 ALL PASS with exact 'ชำระเงินแล้ว รอร้านตรวจสอบ', 'จัดส่งโดย Lalamove' and 'ตำข้าวโพดไข่เค็ม x 1', long item text not clipped, zero horizontal overflow/page errors. Pure unit tests also confirm backend order paymentStatus is never changed and paid/COD self-delivery displays remain correct.
- Functional Slip2Go and server gate checks 16/16, receipt presentation 5/5, complete Operational/React parity, build/postbuild and git diff --check PASS. Signed-in actual customer receipt and real banking slip verification still require user/device acceptance, as live smoke used read-only test fixtures.## 2026-10-09 — Delivery scooter hero icon and saved address Edit/Delete original visual style (Build .507)

User reiterated that the assistant must directly edit on the connected Mac rather than give code patches. User screenshot requested a redesigned scooter icon in Delivery and a return to the previously designed Edit/Delete address icons. The current compact 62px mobile card, GPS rule, and full backend/order behavior must remain unchanged.

Changes:
- `react-app/src/pages/DeliveryPage.jsx`: Delivery header scooter now has `delivery-hero-scooter` class; address Edit icon changed from slender `bi-pencil` to original framed `bi-pencil-square`. Trash semantic `bi-trash3` retained. Edit/Delete callbacks, accessibility labels and disabled states unchanged.
- `react-app/public/parity/css/delivery-addresses.css`: scoped brand-green scooter emblem (light mint tile, centered 20px glyph, 34px mobile / 38px desktop); original distinct action tiles restored (light sage/green Edit with fine border, light rose/red Delete with fine border). Both controls have 30px mobile / 32px desktop square hitboxes, 8px horizontal separation and vertically centered icons. Addresses remain compact 62px mobile / 66px desktop.
- New regression assertions added to `tests/react-parity/delivery-address-book-ui.spec.mjs`: 15/15 PASS. `tests/react-parity/delivery-icon-visual-smoke.mjs` checks actual computed Chrome layout across 320/360/390/440/768/1280 incl green scooter dimensions, centered Edit/Delete, soft filled backgrounds, exactly 8px action gaps, no horizontal overflow and edit dialog opening/closing. All six PASS.
- Bumped release to Build `2026.10.09.507` (Version 0.4.280 unchanged), main generated JS `/react/assets/index-D0M1Jvri.js`, README and docs updated.
- `npm run test:delivery-location-integrity` 12/12, `npm run test:operational` 7/7, full `npm run test:react-parity`, `npm run build:react` and generated-build contract, `git diff --check` PASS. No changes to GPS selection, saved addresses, payment, order, cashier, Firestore or Cloud Functions.
- Only Firebase Hosting `hosting:foodapp` project `chat-45754` may be deployed, no main merge/reset/clean/discard, never delete prior untracked Vite hashed JS. Commit/Push and Production smoke pending as of this note.### Build .507 — Firebase Hosting Production verification completed

- Feature commit `06e24109 ui: refine Delivery scooter and restore address action icon styling` pushed to `origin/feature/react-firebase-port` with ahead/behind `0/0`. Hosting-only `npx firebase-tools deploy --only hosting:foodapp --project chat-45754 --non-interactive` released Build `2026.10.09.507` to `https://penguin-food.web.app` (571 files). Cloud Functions, Firestore and Storage Rules unchanged; no live customer/tenant/order/payment records modified; main not merged and old Vite hashes preserved.
- Live `/s/saas-test-shop/delivery`, `/delivery`, `/admin`, `/cashier`, `/kitchen` HTTP 200 referencing `/react/assets/index-D0M1Jvri.js`, with production JS and `delivery-addresses.css` byte-identical to local compiled files. Previous .506 JS still accessible.
- Installed Chrome on actual Production with isolated guest profiles / emulated device GPS at widths 320, 360, 390, 440, 768, 1280 PASS. Scooter mint-green badge exactly 34x34 mobile / 38x38 desktop, Edit pencil-square on sage background, Delete trash on pale rose background; actions 30x30 mobile / 32x32 desktop, centers deviated 0px, separation exactly 8px, compact card 62px mobile / 66px desktop, no horizontal overflow or runtime JS page errors. Edit dialog opens/cancels as before. No test wrote a production order or live customer profile.
- Address UI regressions 15/15 and location GPS 12/12 PASS, Operational and full React parity, Vite build/postbuild and git diff validation PASS.
- Remaining manual user acceptance: refreshed customer browser screenshot / visual approval on actual device. This was a visual-only icon change.## 2026-10-09 — Per-store Logo + Cover Image on four order flows, with Store Basics uploader (Build .508)

User first rejected repeating Bootstrap scooter/edit/delete icons; requested the **actual store logo** instead and an **uploadable food/store-related Hero card cover** configurable under each shop's Store Settings. User then expanded coverage to Delivery, Table Order, Takeaway and Cashier Quick Order. Direct implementation on connected Mac mandatory; branch feature/react-firebase-port, no reset/clean/merge main, Host-only release unless expressly authorized.

Implementation:
- Added `react-app/src/components/StoreHeroBranding.jsx`: common per-store logo mark using `shopLogoUrl` (legacy `logoUrl` supported), with shop-window fallback on missing/error; `brandedHeroStyle()` uses optional `shopHeroImageUrl` (legacy heroImageUrl fallback) with dark readable gradient overlay, HTTPS-only URL and cover crop. In `store-hero-branding.css`, responsive 39/46px marks, cover image cropping, title wrapping and scoped rules robust to previous POS/ordering Hero CSS. The previous scooter artwork in Hero is entirely replaced rather than merely recolored. Delivery section heading also uses store logo.
- Four pages wired to **the same tenant store settings**: `DeliveryPage.jsx`, `TakeawayPage.jsx`, `PublicOrderPage.jsx` (fetches public store settings alongside menu list without changing table session/rounds), and `QuickOrderPage.jsx` (existing storeSettings). Public payment, saved-address GPS, table rounds, menu calculations and cashier order logic unchanged.
- `StoreBrandingEditor.jsx` integrated under `AdminPage.jsx` Store Basics: choose, preview, replace, remove-on-save logo and cover, locale-aware labels TH/EN/MY/LO/KM, JPG/PNG/WebP under 8 MB. `storeBrandingData.js` resizes/compresses in browser to WebP, retains transparent logo alpha, rejects invalid types and oversized compressed blobs and uploads **only on Save** to `tenants/{tenantId}/product-images/store-branding/{kind}-{timestamp}-{uuid}.webp`; this is under the **existing tenantProductAdmin** 5-MB product-image Storage rule, with no new Rules/deployment. Save persists URLs in `tenants/{tenantId}/settings/store` using pre-existing `saveAdminStoreSettings`, re-reads and verifies URLs. Clearing a picture resets the URL in settings (safe, does not delete existing Storage objects). No guest/public Storage upload privileges. On tenant reload pending selections reset. Store images NOT uploaded to any actual tenant as part of test.
- `DeliveryCustomIcons.jsx` now contains new genuine illustrated SVG Edit and Delete shapes, not Bootstrap font icons; saved address card controls remain 30px mobile /33px desktop and 62px /66px card heights. Obsolete scooter SVG export and its old CSS removed. Legacy Playwright icon assertions updated to new SVG selectors. Legacy `delivery-icon-visual-smoke.mjs` redirected to new branding visual regression.
- Build 2026.10.09.508, Version 0.4.280 retained, bundle `/react/assets/index-BYxDosD9.js`. README / docs updated. New `tests/react-parity/store-branding.spec.mjs` 6/6 PASS and included in full React parity; address UI 15/15, GPS integrity, Operational and full React Parity, Build + generated contract PASS. Static security checks confirm existing tenant-scoped Storage Rules path and no backend/Rules changes. Actual installed Chrome local compiled app 320/360/390/440/768/1280 PASS using isolated Guest profile and read-only logo/banner previews injected in DOM: cover image scales with `background-size: cover,cover`, logos retain square aspect and fallback, admin dual-image preview stacks below 680px and 2 columns desktop, branded Delivery hero respects width; Edit/Delete custom vector icons centered 0px and 8px gap, compact cards 62px mobile /66px desktop, editor modal opens/closes, no horizontal overflow/page errors. **Read-only fixture does not test authenticated real upload**; an actual shop admin must select images and Save for images to appear in that shop.
- No production tenant/settings/customer/order/payment records changed, no Cloud Functions/Firestore Rules/Storage Rules deployments, main not merged, old Vite hashed bundles preserved.
- Commit/Push and Hosting-only deployment + production checks PENDING at this checkpoint; append verification afterward.
### Build .508 — Firebase Hosting production release VERIFIED

- Implementation commit `7f5b241b feat: add store logo and cover uploads across customer ordering pages` pushed to `origin/feature/react-firebase-port`, ahead/behind 0/0. Selective Hosting-only `npx firebase-tools deploy --only hosting:foodapp --project chat-45754 --non-interactive` succeeded (575 Hosting public files), live URL https://penguin-food.web.app. No Cloud Functions, Firestore Rules or Storage Rules deployed. No real store branding asset was uploaded or Firestore store settings mutated during tests. No main merge/reset/clean or removal of historical hashed asset bundles.
- Live HTTP 200 and Build .508 JS `/react/assets/index-BYxDosD9.js` confirmed for `/s/saas-test-shop/delivery`, `/s/saas-test-shop/order`, `/s/saas-test-shop/takeaway`, `/cashier/quick-order`, `/admin`, `/delivery`, `/cashier` and `/kitchen`. Production JS and CSS `store-hero-branding.css`, `admin-store-branding.css`, `delivery-addresses.css` all byte-identical to compiled Mac files. Previous Build .507 JS still accessible.
- Installed Chrome real Production read-only Guest-fixture smoke at 320/360/390/440/768/1280 PASS: branded Hero mark/fallback, gradient and image cover treatment, compact Edit/Delete custom SVG buttons (30/33px, 8px gap, precisely centered), responsive admin logo/cover preview grid one-column mobile/two-column desktop, saved-address Edit modal opens/closes, zero horizontal overflow and page errors. This validates presentation, not authenticated real Storage write; a shop admin must choose images and Save to validate that tenant's upload permissions and see actual branding.
- Operational tests, complete React parity (including new `test:store-branding` 6/6), Vite build/postbuild contract and git diff --check passed. Four ordering pages wired to same stored image URLs; no changes to order/purchase/payment logic.
- User action: visit /admin Store Basics (ข้อมูลพื้นฐานร้าน), upload Logo and Cover images, click Save, refresh Delivery/Table/Takeaway/Quick Order. For shops with no images, fallback shop icon and green gradient remain.
## 2026-10-09 — Large circular shop logo and adjustable Hero cover focal point (Build .509)

User corrected prior request: logo should be a large CIRCLE taking almost the HEIGHT, not the width, of each Hero Card. Explicitly approved recommendations: recommended shop logo 1200x1200px, cover 1600x900px, JPG/PNG/WebP max 8 MB; per-shop drag-to-set focal point for cover shared by Delivery, Table, Takeaway and Cashier Quick Order. Required direct implementation on connected Mac, no code-only answer.

Implementation:
- `react-app/public/parity/css/store-hero-branding.css`: Hero uses a 76px circle at 320px, 88px on typical mobile 360-440px and 112px on desktop, ~65-79% Hero height, white border/shadow, `object-fit:cover`, absolutely placed left and centered vertically. Text/description have reserved area to right; fallback logo also circular. Quick Order nested title wrapper accounted for; Delivery's smaller section icon also circular. The same CSS serves all four ordering pages.
- `react-app/src/utils/storeHeroFocus.js`: normalized/clamped X/Y 0-100 percentage helper defaulting old/unset stores to 50/50; pointer events mapped to actual displayed source image bounds, rounded to 0.1%. `StoreHeroBranding.jsx`: `brandedHeroStyle` applies `backgroundPosition: x% y%` together with existing gradient/photo in all four pages.
- `react-app/src/components/StoreBrandingEditor.jsx`: Admin's cover uploader retains the existing cropped image preview but adds the uncropped image draggable point target via pointer capture (mouse/pen/touch), visible crosshair and percentages, keyboard arrows (2% / Shift+arrow 10%) with Home reset, explicit center button, accessible labels and selected preview `object-position` matching the same saved focus; selecting/removing a cover resets focus to 50/50. No duplicate uploads or changes to logo/cover storage path.
- `react-app/src/pages/AdminPage.jsx`: keeps default focus in store form, loads saved `shopHeroFocusX/Y` from tenant store settings, includes them in same existing `saveAdminStoreSettings` payload, verifies numeric read-back and resets form values after save; no extra backend endpoint/Firestore rule necessary.
- `react-app/public/parity/css/admin-store-branding.css`: adds mobile-friendly large source-image focus stage with overlaid crosshair, pointer/touch-action none and keyboard outline, integrated with existing logo/cover previews. `parity-translations.json` now displays 1200×1200 square logo, 1600×900 landscape cover, accepted PNG/JPG/WebP max 8 MB and focus/reset guidance across Thai/English/Myanmar/Lao/Khmer.
- Release bumped to **2026.10.09.509** (Version 0.4.280 unchanged), README updated. New `tests/react-parity/store-hero-focus.spec.mjs` included in full React parity; 6/6 PASS including focus clamp, pointer positions, Admin read/write and all-four Hero calls, accessibility keyboard and 5 locales. Existing brand tests 6/6 and full React parity/operational/build/postbuild pass. Generated JS `/react/assets/index-DcBPBVN_.js`.
- Actual installed Chrome against compiled local Delivery at 320/360/390/440/768/1280 passed existing branding visual smoke: circular logo display no horizontal overflow, responsive Admin preview and Edit/Delete controls preserved. Additionally ran REAL React `StoreBrandingEditor` in a temporary Vite-only test harness at viewport widths 320,440,1280: pointer drag moved 50/50 to 75/25 and preview object-position immediately matched, keyboard ArrowLeft moved to 73%, Reset back 50/50, touchscreen tap updated marker, no horizontal overflow. Both temporary harness files and temporary runner created for the test were carefully removed afterward; no user files discarded.
- Cross-surface CSS visual fixture `tests/react-parity/store-hero-round-visual-smoke.mjs` validates logo radius, spacing and focus background-position at 320/390/440/768/1280 across four Hero DOM structures; this fixture performs no Firestore writes or image uploads.
- Scope is UI and two settings fields only. Existing tenant product-image Storage rules and upload compression unchanged; no Functions/Firestore Rules/Storage Rules deployment and no real tenant photos/settings/customer/order/payment writes. Branch feature/react-firebase-port; do not merge main/reset/clean; retain historic Vite hashed bundles.
- Implementation Git Commit/Push and Hosting-only Deploy **pending** at this checkpoint. Live authorized admin uploading and saving to Firestore remains user acceptance (no real store images changed during tests).

### Build .509 — Firebase Hosting Production release VERIFIED

- Feature implementation commit `4769d38a feat: add circular store hero logo and draggable cover focal point` pushed to `origin/feature/react-firebase-port`, ahead/behind `0/0`. Selective `npx firebase-tools deploy --only hosting:foodapp --project chat-45754 --non-interactive` succeeded to `https://penguin-food.web.app` (576 public files). No Cloud Functions/Firestore/Storage Rules deployments, real tenant setting/image writes, main merge, reset/clean/discard or removal of old Vite hashed bundles.
- Production HTTP 200 and JS `/react/assets/index-DcBPBVN_.js` for `/s/saas-test-shop/delivery`, `/s/saas-test-shop/order`, `/s/saas-test-shop/takeaway`, `/cashier/quick-order`, `/admin`, `/delivery`, `/cashier`, `/kitchen`. Production JS plus `store-hero-branding.css` / `admin-store-branding.css` byte-identical to compiled Mac outputs. Prior Build `.508` JS remains accessible.
- Installed Chrome **production** CSS fixture test at 320/390/440/768/1280, covering the Delivery, Table, Takeaway and Quick Order Hero structures: PASS. Circular logo radius 50%, diameters 76/88/112px, text separated, focus `82% 18%` applied consistently to both background layers, clipped decorative Hero effects, **zero horizontal page scroll or JS errors**. Separate live actual shop Delivery page smoke at 440 and 1280 PASS: 88px/112px round logos, no horizontal scroll, existing store with unset focus falls back to `50% 50%`; cover asset URL present. Production smoke did not validate decoded logo image pixels (its remote image had not completed loading at the measurement instant), so claim only geometry and CSS state.
- Full React Admin focus editor functional test was conducted pre-deploy against actual React component on Vite test harness (mouse drag 75/25, touch tap, keyboard increment, reset) across 320/440/1280, then temporary harness files were removed. Admin authenticated real save/upload still requires user acceptance; no existing store image or focal position was changed by tests.
- Regression suites: store focal point 6/6 and existing store branding 6/6; full Operational/React parity and Build/postbuild PASSED; generated build contract confirmed `.509`. Safe changed files commit pushed. Project branch remains `feature/react-firebase-port` without main merge.
## 2026-10-09 — Delivery saved-address three-icon visual redesign (Build .510)

User posted image criticizing the previous dense custom Edit/Delete icons on compact saved delivery address cards and explicitly asked assistant to implement new icons, including the three controls Add Address, Edit, Delete. Directly implemented on connected Mac at branch feature/react-firebase-port.

- `react-app/src/components/DeliveryCustomIcons.jsx`: replaced previous dense hand-drawn/filled SVGs with consistent 24x24 open-stroke Lucide-style **Plus, Pencil and Trash2** silhouettes (all 1.9 stroke, round caps/joins, no filled ornaments). Added `DeliveryAddArtwork`, preserved named `DeliveryEditArtwork`/`DeliveryDeleteArtwork` and `data-delivery-icon` selectors for accessibility/tests; no third-party package or runtime dependency introduced.
- `react-app/src/pages/DeliveryPage.jsx`: Header Add and conditional Add-in-address-choice notice both now use the same SVG Plus; Edit/Delete continue using their existing handlers, disabled logic, title and localized aria-label. GPS radius/saved-address-only checkout, customer/order data, modal actions and Hero branding were not changed.
- `react-app/public/parity/css/delivery-addresses.css`: replaces heavy outlined edit/delete tiles with minimal soft-sage Edit and soft-blush Delete ghost backgrounds, transparent borders, 31x31px Mobile /33x33px desktop controls and 18/19px icons, gap 9px Mobile /10px desktop; consistent 17px Plus centered in Add button. Card heights remain 62px phone and 66px desktop. No horizontal overflow; no Home default-control action added.
- Release bumped to `2026.10.09.510` (Version 0.4.280 unchanged). README updated. Added two regression cases to `tests/react-parity/delivery-address-book-ui.spec.mjs` ensuring all three SVG shapes belong to same set and accessibility/handlers unchanged (17/17 PASS). GPS integrity 12/12 PASS; complete Operational/React Parity and generated Vite Build/postbuild contract PASS. New hashed JS `/react/assets/index-Bjs7TiRD.js`.
- Installed Chrome tested *real compiled Delivery app* in isolated Guest profile/GPS at width 320: all three icons visually centered, 31px action buttons, Add and Edit dialogs opened/canceled, 62px cards, no overflow or runtime page errors. Further real Firebase-backed 360px attempt timed out waiting for saved address profile load; not evidence of icon failure. Separated display geometry from external data by adding `tests/react-parity/delivery-icon-triad-css-smoke.mjs`, which loaded the compiled CSS with exact real icon SVG paths in a read-only DOM fixture; all widths 320/360/390/440/768/1280 PASS, zero center deviation, action gaps 9/10px, card 62/66px, zero horizontal overflow.
- This is a visual-only action-icon change; no real tenant/customer/order/payment records or Firebase Storage/Firestore writes. Branch feature/react-firebase-port, no main merge/reset/clean, retain historic hashed bundles. Commit/Push/Hosting-only deploy and live Production verification pending.
### Build .510 — Firebase Hosting Production VERIFIED

- Implementation commit `238de3c0 ui: unify delivery address add edit delete icons` pushed to `origin/feature/react-firebase-port` with ahead/behind `0/0`; selective `npx firebase-tools deploy --only hosting:foodapp --project chat-45754 --non-interactive` succeeded at https://penguin-food.web.app (577 Hosting files). Did not deploy Cloud Functions/Firestore/Storage Rules, change real customer/order/tenant data, merge `main`, reset/clean, or remove any historical hashed bundles.
- Live pages `/s/saas-test-shop/delivery`, `/delivery`, `/admin`, `/cashier`, `/kitchen` all HTTP 200 referencing Build `.510` JS `/react/assets/index-Bjs7TiRD.js`. Production main JS and `/react/parity/css/delivery-addresses.css` byte-identical to Mac-generated files; previous `.509` JS bundle remains accessible.
- Installed Chrome **Production** ran isolated compiled-CSS + exact SVG DOM fixture `tests/react-parity/delivery-icon-triad-css-smoke.mjs` at viewports 320/360/390/440/768/1280, ALL PASS: Plus 17px, Pencil/Trash 18px mobile /19px desktop, Edit/Delete buttons 31px phone /33px desktop, glyph centers 0px deviation, 9px/10px gaps, cards remain 62px phone /66px PC, zero horizontal overflow. Non-destructive real local guest-GPS React at 320px also PASS including opening/canceling both Add and Edit dialogs; Firebase-based full browser profile load intermittently timed out at 360px in local smoke, so we do not claim complete six-width authenticated functional regression. Scoped static/action/unit suites and full React parity/build PASS.
- Source and browser now use matching three-item outline stroke icon family; this is an appearance-only UI change. User can refresh Delivery and review icons visually on their device.

## 2026-10-09 — Authorized fast-forward merge of React feature branch into main

- User expressly requested **commit, push, merge to `main`** after Delivery icon Build `.510`. This authorization supersedes the historical 'do not merge main unless asked' instruction for this operation only; production deployment scope is NOT expanded.
- Before merge: `origin/main` at `013fd5ad` (`feat: centralize subscription pricing and header layout`), `origin/feature/react-firebase-port` at `67ad1f9d` (`docs: verify Delivery address icon set Build .510 on production`); ahead/behind main...feature `0 / 477`. `origin/main` was a direct ancestor of feature, so no divergent commits or conflicts; `git fetch origin --prune` completed.
- Pre-merge validation from the authorized Mac original feature worktree: `npm run test:operational` **PASS** (7 tests), `npm run test:react-parity` **PASS**, `npm run verify:react-build` **PASS** (Build 2026.10.09.510, `/react/assets/index-Bjs7TiRD.js`), `git diff --check` **PASS**.
- Working directory has 16 old untracked Vite hashed JS bundles intentionally preserved (`emptyOutDir:false`); no arbitrary reset, clean or discard. An isolated NEW temporary Worktree at `/private/tmp/food-order-app-main-ff-20261009-2128` was created on `main`, leaving the existing feature worktree untouched. In that isolated worktree, `git merge --ff-only origin/feature/react-firebase-port` advanced local `main` from `013fd5ad` to `67ad1f9d` with no conflict and exact commit+tree equality confirmed against feature.
- This documentation commit belongs to the merged `main` history and will be fast-forward propagated back to `feature/react-firebase-port` so both branches remain in sync; remote GitHub refs should be checked after the pushes. This merge does NOT trigger a second Firebase Hosting deploy because no application code/Build changed after already-deployed `.510`, and does NOT deploy Functions or Security Rules.


---

## 2026-10-10 — Tenant Delivery payment methods / Kitchen loading (Version 0.4.281 Build 2026.10.10.511)

Request: Fix a misleading Kitchen load-error banner while cards were visible, and keep store-managed COD optional. The active self-delivery store uses prepayment with Slip2Go auto-check; if Slip2Go is temporarily unavailable, Cashier must verify the slip before Kitchen admission.

Root causes: KitchenPage used the generic loadOperationalSnapshot that also reads tenant heldBills, which Firestore restricts to Retail POS businesses. Promise.all failed for restaurant-only tenants even though the live order listener succeeded, leaving a stale load warning. Delivery checkout previously always offered COD without per-tenant toggle, and public server checkout did not verify that the payment option was enabled.

Implemented: Added loadKitchenMenus (settings and restaurant menus only) and independent orders onSnapshot with separately tracked errors and readiness. Added deliveryPromptPayEnabled and deliveryCodEnabled booleans in Admin Store Payments with persisted readback checks and prevention of disabling both methods. Legacy settings without either field continue to allow both until expressly disabled. Delivery live store settings show only enabled methods and reselect a valid method when settings change. submitPublicDeliveryOrder checks both settings inside the existing authoritative Firestore store-hours transaction and refuses a disabled COD or PromptPay method. Existing cashier-only manual approval for non-verified prepayment, trusted Slip2Go matched release, COD immediate admission when enabled, tenant scope, business guard and protected payment fields are unchanged. Added TH/EN/MY/LO/KM labels and guard-error text.

Verification: npm run build:react + generated React build contract PASS (build 2026.10.10.511, JS index-PV9uUcY7.js); npm run test:react-parity PASS including Foundation, Migration, Parity Matrix, P0 Actions, Callable, Tenant Access, UI Layer and all expanded flow tests. Focused Slip2Go+Kitchen 17/17, server delivery guard 9/9, Business Access 2/2, Operational Orders PASS; git diff --check PASS. No live signed-in customer checkout, real payment, or physical Kitchen print test performed.

Key files: react-app/src/pages/{AdminPage,DeliveryPage,KitchenPage}.jsx, react-app/src/data/operationalData.js, react-app/src/i18n/parity-translations.json, functions/public-delivery-submit.js, tests/react-parity/delivery-{server-guard,kitchen-gate,slip2go-flow,opening-hours}.spec.mjs, react-app/src/config/release.js, tools/react-foundation-contract.mjs, README.md, docs/NEXT_CHAT_HANDOFF.md, generated React bundle/HTML entrypoints.

Deployment state: Implementation commit 7ab83f48 pushed to origin/feature/react-firebase-port (0/0); no main merge. Firebase Hosting and Cloud Function NOT deployed. To release payment toggles safely requires deploying the changed Cloud Function submitPublicDeliveryOrder along with Hosting; project convention permits Hosting-only by default, so user authorization for Function deployment is needed before release. Do not deploy frontend alone. Prior untracked hashed assets retained; live tenant settings and orders unchanged.

Follow-up: After deployment authorization, deploy Function and Hosting in a coordinated release, hard refresh Build 2026.10.10.511, then test on a real restaurant_cafe tenant using temporary safe test orders: COD off/on, PromptPay auto-match, manual cashier review, Kitchen admission, and restored-error behavior. No SQL migration necessary for Firestore settings booleans.

---

## 2026-10-10 — Production deployment: Delivery payment and Kitchen fix

Authorization: User expressly approved deploying Cloud Function submitPublicDeliveryOrder and Firebase Hosting for project chat-45754. Branch feature/react-firebase-port; implementation commit 7ab83f48; release 0.4.281 / Build 2026.10.10.511.

Backend: Deployed only functions:submitPublicDeliveryOrder (Node 22, 2nd Gen, asia-southeast1). Firebase CLI logged successful update operation and Deploy complete. No other Cloud Functions deployed. The firebase-functions package age warning was non-blocking; no dependency upgrade was made.

Hosting: Deployed only hosting:foodapp. Firebase confirmed version finalized and released; 579 public files; Hosting URL https://penguin-food.web.app; command exit code 0.

Production smoke: /admin/, /delivery/, /kitchen/, /cashier/ returned HTTP 200 and use /react/assets/index-PV9uUcY7.js. Production/local SHA-256 both a3862833e2fc1e7fff6b0a71427465276d1530a54987351f3fcdc72746c05ecb. Preflight build contract, Delivery Server Guard 9/9, Slip2Go and Kitchen 17/17, full React Parity and JS syntax checks passed.

Scope: No Firestore Rules, Storage Rules, main merge, actual customer/order/payment data edits or tenant setting changes. Previous untracked hashed JS bundles preserved. Authenticated end-to-end purchase, Slip2Go interruption, Cashier approval and Kitchen notification still require real-account acceptance testing with safe test orders.

Build 2026.10.10.511 is now deployed; increment Build before any future Hosting deployment.

---

## 2026-10-10 — Cashier receipt print tab instant waiting screen, Build 2026.10.10.512

Symptom: With Delivery PromptPay manual cashier review (Slip2Go temporarily unavailable), cashier confirmed the payment and then saw an empty white receipt tab for 5–10 seconds before print began.

Root cause: CashierPage opens window.open("", "_blank") synchronously before awaiting approveDeliveryPaymentReview, but its new about:blank tab was not populated until Firestore-backed approval completed. This was a UI/print-tab readiness gap, not a change to receipt data, payment approval, or Kitchen gating.

Change: Added react-app/src/utils/receiptPrintWindow.js, which synchronously renders a standalone centered loading view with PENGUIN branding, an animated spinner, accessible status and localized progress text in the popup on click, before the async approval. CashierPage imports the helper, shows payment confirmation then receipt preparation before navigating the same tab to /cashier/receipt/?order=...&autoprint=1 or the existing table receipt path. On failed approval, the popup still closes; if the popup is blocked/initialization fails, the existing same-tab navigation fallback remains. Text is assigned with textContent. Payment approval, COD, Slip2Go, Kitchen release, receipt print trigger and Cloud Functions are unchanged.

Key files: react-app/src/utils/receiptPrintWindow.js, react-app/src/pages/CashierPage.jsx, react-app/src/i18n/parity-translations.json, tests/react-parity/cashier-receipt-loading*.spec.mjs, package.json, react-app/src/config/release.js, tools/react-foundation-contract.mjs, generated public/react/entrypoints and bundle, README.md, docs/NEXT_CHAT_HANDOFF.md, docs/WORKLOG.md.

Verification: Node receipt-popup regression 6/6 PASS; real installed Chrome popup smoke at 390 and 1280px 2/2 PASS, visible centered spinner, immediate message, language, no overflow, then status transition. Full npm run test:react-parity PASS; npm run build:react plus verify:react-build PASS, new JS index-Bm69FZDi.js, Version 0.4.282 Build 2026.10.10.512; git diff --check PASS. No authenticated real order/payment or physical printer test.

Deployment: Hosting-only UI fix prepared on feature/react-firebase-port. No Cloud Function, Rules, tenant/order/payment data changes or main merge. Old untracked Vite hashed JS bundles preserved. Verify deployment and user acceptance of real cashier manual-review timing after release.

---

### 2026-10-10 — Cashier loading screen: Hosting deployment and Production verification

- Implementation commit 6fe6c9ac was pushed to origin/feature/react-firebase-port. No main merge.
- Firebase Hosting-only deployment completed: npx --no-install firebase-tools deploy --only hosting:foodapp --project chat-45754 --non-interactive; 580 public files, Firebase reported version finalized, release complete and Deploy complete (exit 0). No Cloud Function or Firestore/Storage Rules deployed.
- Production /cashier/, /cashier/receipt/, /kitchen/ and /delivery/ each returned HTTP 200 with /react/assets/index-Bm69FZDi.js. Production JS and Mac build SHA-256 both b0a363a69a78c280ab12e400117c0c5181940206b00f272dfdc30e4bc01222c6. React release 0.4.282 / Build 2026.10.10.512 is live.
- Automated checks PASS: full React parity, receipt popup unit 6/6, real Chrome browser popup 390px and 1280px 2/2, generated Vite build contract. No live tenant, order, customer or payment records written.
- Follow-up: perform manual cashier PromptPay slip approval with a safe real test order and confirm immediate spinner, backend release, receipt automatic print dialog and Kitchen admission; this authenticated flow was not exercised in deployment smoke. Next Hosting release must bump Build. Historical untracked bundles preserved.

---

## 2026-10-10 — Cashier View Bill Modal and Kanit print loading screen

Request: From Production screenshots, user asked to make the Cashier eye/"View bill" action display an in-page modal; remove the PG PENGUIN center emblem from the pre-print spinner screen, use shared UI font, and change Thai message to "ระบบกำลังเปิดหน้าพิมพ์ใบเสร็จ กรุณารอสักครู่...".

Root cause: The Delivery card's orange eye action (formerly view_slip) used an external slip href target _blank, taking cashier away from the primary screen. The recently added immediate receipt loader used generic system-ui and a standalone brand element instead of the primary PENGUIN Kanit Local font.

Changes: CashierPage's view-bill button now opens a same-page bill preview dialog, including order status, payer/customer info, items, notes, subtotal/delivery fee, total and inline payment slip (when applicable). Similar buttons added for Take Away, Walk-in and Table group cards; printer links/actions and payment release untouched. Dialog uses global UI modal layer, body scroll lock, focus management, Escape/outside close, responsive max-height and inner scrolling; existing receipts still print via their separate route. Print waiting popup retains spinner, removes header brand block and uses locally hosted Kanit Regular/SemiBold with the app's fallback family. Thai receipt-opening status updated exactly as requested. All five supported locales have bill dialog copy.

Files: react-app/src/pages/CashierPage.jsx, react-app/src/utils/receiptPrintWindow.js, react-app/src/i18n/parity-translations.json, react-app/public/parity/css/cashier-refresh.css and synchronized public/react/parity CSS, tests/react-parity/cashier-bill-preview*.spec.mjs, cashier-receipt-loading*.spec.mjs, package.json, release.js, tools/react-foundation-contract.mjs, README.md, docs/NEXT_CHAT_HANDOFF.md, generated Build .513 files.

Verification: Full React Parity PASS, Cashier bill preview source/contract 4/4, receipt spinner unit 7/7, installed Chrome CSS modal widths 320, 440 and 1280 (3/3), Chrome actual receipt popup at 390 and 1280 (2/2), Vite React Build and generated contract PASS. Hash name index-DHwYQlC7.js, Version 0.4.283 / Build 2026.10.10.513. No actual signed-in Cashier payment test; manual acceptance necessary.

Release state: Hosting-only UI release prepared. No Cloud Functions, Firestore Rules, Storage Rules, tenant/order/slip mutations or main merge. Do not remove historical untracked bundles. Build .513 must be bumped again before any subsequent Hosting release.

---

### 2026-10-10 — Cashier bill modal release .513 deployed to Production

- Implementation commit a73fdc3b pushed to feature/react-firebase-port, remote branch synced 0/0. Deployment approved under existing Hosting-only workflow; no main merge.
- Hosting-only deployment succeeded: npx --no-install firebase-tools deploy --only hosting:foodapp --project chat-45754 --non-interactive (exit 0, 581 public files, version finalized/released). Live https://penguin-food.web.app/cashier uses Version 0.4.283 / Build 2026.10.10.513.
- Smoke: /cashier/, /cashier/receipt/ and /kitchen/ all HTTP 200 using /react/assets/index-DHwYQlC7.js. Live and Mac JavaScript SHA-256 f35bf105dd77c9612077d385adb0b5a02c8eb888cb2ec6f54a3913beb5db29d1. Live and Mac cashier-refresh CSS SHA-256 75ba92dce63f6d39dedbb351f5c74dc37318e3d0aa1325f5a0d6f56c7a0ade08.
- Local validation: full React parity and built contract PASS; bill-preview source and locale regression 4/4; receipt loader 7/7; Chrome modal viewport fixture at 320/440/1280 and spinner popup smoke at 390/1280, browser 5/5 PASS.
- No Cloud Function, Rules, or live customer/order/payment records changed. Previously untracked hashed bundles kept intact. Authenticated user acceptance for viewing an actual slip and receipt print still required. Bump Build before any subsequent Hosting release.
