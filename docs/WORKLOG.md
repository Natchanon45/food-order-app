# Development Worklog

Updated: 2026-10-05

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
