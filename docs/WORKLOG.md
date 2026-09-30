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
