# Next Chat Handoff — React + Firebase Migration

Updated: 2026-10-10
Project: Food Order / Delivery / Retail POS
Repository: `Natchanon45/food-order-app`

## 2026-10-19 — Hybrid Billing phase 2 paid Delivery calculation preview (.526), candidate only

- Follow from phase1 commit `886ca7e3` in food-order-app feature/react-firebase-port. User directs work **only** in this repository. Preserve 21+ historical untracked JS bundles; no reset/clean.
- Added trusted paid Delivery order merchandise mapping `functions/hybrid-billing-orders.js`, protected read-only `getTenantHybridBillingPreview` callable `functions/hybrid-billing-preview.js` and index registration. Base = paid server-stamped Delivery-only minus shipping/refunds, no POS or unpaid orders.
- New `/reports/hybrid-billing` authenticated monthly preview page and dashboard card; 5 locale texts/CSS/physical entrypoint/parity route registry. Tenant guards preserve Owner/Admin billing report during **future** hybrid suspension while excluding staff. No actual suspension flag writer yet.
- Candidate release Version **0.4.296** Build **2026.10.19.526**. Production is still Version 0.4.294 / Build .524. `HYBRID_REGISTRATION_READY=false` remains. Do NOT deploy: this is read-only billing estimate, no issued invoices or collection.
- Added `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md` with a complete copy/paste command to continue in a fresh chat, and updated `docs/HYBRID_BILLING_IMPLEMENTATION.md` with the next steps. Read both first in new chat.
- Open phase3 tasks: server-side immutable invoice/payment-ledger and day-by-day posting, Slip2Go+manual confirmation, next-day restriction/recovery, slip quota, Rules, staging/UAT and rollout approval. No production tenant/order/payment writes or Firebase Deploy.

## 2026-10-19 — Hybrid Billing phase 1 guarded candidate, DO NOT DEPLOY (.525)

- User scoped work exclusively to food-order-app; old Git main/feature and remotes were synced at f3bf467b before starting. Historic 21 untracked JS bundles preserved.
- User-defined policy: first month no fixed fee, but immediate Delivery-only share if threshold reached; following months either monthly fee below threshold OR Delivery share from threshold (not both); threshold date pays share on threshold only, subsequent dates daily Delivery sales, bill overdue next day suspended, reset monthly, Super Admin-configurable amounts/quotas.
- Implemented pure functions/hybrid-billing-core.js, settings callables and public pricing, new service-only React RegisterPage, PlatformPricingPage editor, server hybrid_v1 signup policy routing with immutable initial snapshot, legacy subscription scheduler guard, five-locale copy, test updates and docs. Signups are deliberately fail-closed via HYBRID_REGISTRATION_READY=false until backend billing settlement/entitlements integrated.
- Reference docs/HYBRID_BILLING_IMPLEMENTATION.md. This is a developer candidate, not a billing release. No Firebase Hosting/Functions/Rules production deploy and no tenant/order/payment writes. Production remains Version 0.4.294 Build .524. Do not send production deploy command until remaining daily invoices, paid-slip verification, access gate and quota implemented/tested.

## 2026-10-18 — User-authorized Commit/Push/Fast-forward main merge of POS mobile header and floating badge (.523/.524)

- User explicitly approved Commit, Push and Merge to main for both already-deployed releases: Build 2026.10.18.523 mobile POS header same-row buttons across 15 POS pages and Build 2026.10.18.524 Developer Panel green floating badge visible across 17 interactive POS screens. Production remains Version 0.4.294 Build 2026.10.18.524.
- Mac on feature/react-firebase-port at e7786e06, tracked changes matched expected header CSS, four POS pages missing Developer Panel style/component, test/package/release/docs and generated Build .524 entrypoints. origin/main and origin/feature/react-firebase-port were both e7786e06, no divergence, verified Fast-forward ancestry. There were 22 untracked Vite hashed JS outputs before staging, including current .524; all 21 previous hashed JS files preserved with no reset/clean/deletion.
- Pre-merge validation repeated: npm run test:react-parity PASS, npm run verify:react-build PASS (Version 0.4.294 Build 2026.10.18.524, asset index-BBgbyzkx.js), POS mobile header static regression 3/3 PASS + Chrome 5/5 PASS across 35 representative phone scenarios, POS floating badge static 3/3 PASS + Chrome 3/3 PASS at 320/430/1280. git diff --check and staged diff --check PASS.
- Staged approved tracked files, 4 new mobile-header/floating-badge test scripts and only current Build .524 hashed JS asset, leaving old 21 hashed JS files untracked. Implementation commit 4b2fe62b (fix: keep POS mobile headers inline and restore floating badges), pushed to origin/feature/react-firebase-port, confirmed 0/0 and clean tracked tree.
- git fetch origin main feature/react-firebase-port; git switch main; git merge --ff-only feature/react-firebase-port; git push origin main succeeded, advancing e7786e06 -> 4b2fe62b without conflict, main tracking 0/0, verified ancestry main contains feature.
- Docs-only audit commit to be pushed on main and synchronized by --ff-only to feature/react-firebase-port, then Mac checkout returned to feature. Both releases were already live on Firebase Hosting and hashes were validated; do not repeat Hosting deploy or bump Build solely for Git merge. No Cloud Functions/Rules, Firestore data, tenant permissions, or real user writes.

## 2026-10-18 — Restore POS floating Version/Build badge on all interactive screens (Build .524)

- User reported that the small green floating Developer Panel/Version/Build badge was missing on the LAST TWO POS navigation menus (Backup and Users) and requested that it be present on every POS page.
- Investigation: the existing React AppDeveloperPanel component is mounted on /pos/backup and /pos/users, but those pages' useParityPage CSS arrays omit app-version-badge-runtime.css, which is required for fixed position/visible green dot and overlay styling. Root cause matches an earlier POS Returns visual-parity issue recorded 2026-10-03. Audited 17 interactive POS screens: 13 already had both component and CSS, Backup/Users missing stylesheet, Catalog and Forbidden lacking BOTH component and stylesheet. No change intended to specialized receipt, invoice print or customer-display-only surfaces.
- Fix: added the existing app-version-badge-runtime.css to styles arrays of PosUsersPage.jsx and PosBackupPage.jsx. Mounted the existing AppDeveloperPanel once and loaded its unchanged runtime CSS on PosCatalogPage.jsx and PosForbiddenPage.jsx. No new floating design and no override of common CSS/visual semantics; the existing button opens the existing read-only Developer Panel.
- Added tests/react-parity/pos-floating-developer-badge.spec.mjs to assert 17/17 interactive POS pages mount exactly one AppDeveloperPanel and load runtime CSS, plus base component's accessible button and open handler (3/3 PASS); tests/react-parity/pos-floating-developer-badge-browser.spec.mjs verifies actual runtime CSS and badge + dialog interactions on installed Chrome at 320px, 430px and 1280px (3/3 PASS). Both wired into package.json unit and browser parity scripts. Full npm run test:react-parity PASS, npm run build:react and verify:react-build PASS.
- Production LIVE: Firebase Hosting-only project chat-45754 hosting:foodapp deployed (621 public files, exit 0). All 17 interactive POS routes /pos, /pos/sales, /pos/tax-invoices, /pos/returns, /pos/shifts, /pos/products, /pos/stock-movements, /pos/stock-counts, /pos/purchases, /pos/payables, /pos/suppliers, /pos/customers, /pos/settings, /pos/backup, /pos/users, /pos/catalog, /pos/forbidden HTTP 200 and served JS index-BBgbyzkx.js. Production/local JS SHA-256 16244ace9d06dd138ae5ab84feae458e07a513149510eda4f6ef86fabd8b241f match; standard floating CSS SHA-256 2f4f1b974ffe95b47042846507669e77fe0adfb6d74f027f8bfa764b1a754fa2 match. No Git commit/push/merge; previous .523 mobile-header changes still uncommitted. No Functions/Rules, database writes. Preserve 21 old untracked hashed bundles plus .524 and bump Build for next Hosting deploy. Ask user to hard-refresh /pos/backup and /pos/users for authenticated visual acceptance; print-only and customer-display POS views intentionally not included.

## 2026-10-18 — Unified one-row mobile headers across POS menus (Build .523)

- User screenshots from iPhone 15 Pro Max emulation 430px show /pos/users and /pos/backup with language and menu controls stacked vertically while /pos/sales keeps both on one horizontal row. Requirement: POS page header controls never wrap to two rows, title/description may wrap to two lines, apply to all POS menus.
- Started Mac feature/react-firebase-port at e7786e06, tracked files clean, origin 0/0, 20 older untracked hashed Vite assets preserved. Root cause: common retail-pos.css .header-actions flex-wrap was wrap and could shrink so the two buttons stacked, while sales and some custom screens had page-specific nonwrapping rules.
- Added one scoped mobile max-width 760px block in react-app/public/parity/css/retail-pos.css, marker RETAIL_POS_MOBILE_HEADER_ONE_ROW_20261018_523: outer header flex row nowrap, flexible title width, title and description clamped to 2 lines, right controls nonshrinking nowrap with 8px gap and Y-centered. Handles extra back/navigation links with max-width. Applies to supporting/management headers; no desktop, business logic or Firestore changes.
- New node test tests/react-parity/pos-mobile-header-one-row.spec.mjs verifies shared CSS usage and markup across 15 POS menu pages and rules 3/3 PASS. New Playwright tests/react-parity/pos-mobile-header-browser.spec.mjs tests installed Chrome across 7 representative POS page header styles and mobile widths 320,360,390,430,440 (35 cases, 5/5 PASS), no wrapped actions, at least 7px gap, max two description lines, no overflow. Both test scripts integrated into React parity suites.
- Production LIVE: Firebase Hosting-only deploy project chat-45754 hosting:foodapp succeeded (620 public files, exit 0). GET all 15 POS menu routes /pos/users, /pos/backup, /pos/sales, /pos/settings, /pos/customers, /pos/suppliers, /pos/purchases, /pos/products, /pos/stock-movements, /pos/stock-counts, /pos/tax-invoices, /pos/payables, /pos/shifts, /pos/returns, /pos/catalog HTTP 200 and referenced /react/assets/index-CC3-Nr6Q.js. Production and local JS SHA-256 e95d01513d561ff4d7d4a7aea38f7f3286b4e29b42ac7dd8f6f5d783072ae493 match; POS shared CSS sha256 0ceffa8b4b3da1e31826a25207a682fee0d0c1561960769395bd842a09d35c87 matches. No Cloud Functions/Rules, data writes, Git commit/push/main merge. Preserve 20 older untracked hashed JS outputs plus .523, bump release identity before next Hosting deploy. User to hard-refresh /pos/users, /pos/backup and /pos/sales for visual confirmation on real mobile.

## 2026-10-18 — User-authorized POS Users .522 Commit/Push/Fast-forward main merge

- User explicitly authorized Commit, Push and Merge of the previously deployed and tested POS Users roles/actions + shared dark black Toast work (Version 0.4.292 / Build 2026.10.18.522). The repository was on feature/react-firebase-port, synced 0/0 against origin and main/feature began at bed69c14. Tracked changes matched expected POS Users code/CSS, translations, tests, release metadata, documentation, generated React entrypoints and current asset. Preserved all 19 historic hashed Vite bundles and the previous .521 bundle without reset/clean.
- Validated npm run test:react-parity PASS, npm run test:pos-users-ui-toast 4/4 PASS, npm run test:pos-users-ui-browser 2/2 PASS at 390/1280 (shared black Toast/green-red icons, X center, 75vh, z-index, native dialog top layer), npm run verify:react-build PASS for .522 index-q1xQGsY6.js and git diff --check PASS. No authenticated role mutations executed.
- Staged tracked changes, 3 new POS Users test/fixture files and ONLY current public/react/assets/index-q1xQGsY6.js. Implementation commit 12ae2d4e (fix: align POS Users actions and restore shared role-save toast) pushed to origin/feature/react-firebase-port, synced 0/0, tracked tree clean, 20 legacy JS assets still untracked.
- git fetch origin main feature/react-firebase-port; git switch main; git merge --ff-only feature/react-firebase-port; git push origin main succeeded, advancing main bed69c14 -> 12ae2d4e with zero conflicts and main origin 0/0, feature ancestry verified.
- Documentation-only audit commit will be pushed on main, then synchronized to feature/react-firebase-port with --ff-only and local checkout returned to feature. Firebase Hosting already ran for .522, no redeploy, Cloud Functions/Firestore Rules or data changes performed by Git operations.

## 2026-10-18 — Restore PENGUIN shared black role-save Toast on POS Users (Build .522)

- User saw Build .521's standalone custom POS Users role-save notification as a green/red pale box at top-right, explicitly requested the standard PENGUIN black-background Toast with white text, success green / failure red icon, highest UI Layer, and centered at 75vh (middle of lower half of viewport, measured relative to footer), as on other pages.
- Found existing react-app/public/parity/css/toast-global-policy.css and ui-layer-stack.css; the standard Toast already styles app-toast success/error + app-toast-icon/app-toast-message with dark #111 background, green #22c55e/red #ef4444 icon, center X and 75vh, z-index 2147483647. The top-layer manager in react-app/src/ui/toast-top-layer.js observes visible Toasts and promotes body-originating Toast above showModal dialogs.
- Reused the original Toast infrastructure: PosUsersPage imports createPortal from react-dom, renders only when toast state contains a message using createPortal into document.body; standard app-toast success/error show classes, data-ui-layer=toast, standard icon/message markup, semantic role/aria-live remain; removed .pos-users-toast CSS block from retail-pos-users-visual-dashboard.css entirely. No global policy changes or invented new styles. Existing role save await-then-success, errors, five translations and 3-second auto-dismiss preserved; all Build .521 other button/icon/color fixes retained.
- Tests: pos-users-buttons-toast.spec.mjs 4/4 PASS checks shared global policy and portal markup and original role-save authorization flow, real Chrome 390px/1280px browser CSS fixture 2/2 PASS measured dark RGB 17,17,17 / white text / green RGB 34,197,94 / red RGB 239,68,68 / horizontal midpoint / vertical 75vh / z-index max; native dialog Top Layer promotion observed true. Full npm run test:react-parity PASS, npm run build:react + verify:react-build PASS.
- Production Hosting LIVE: Firebase project chat-45754 hosting:foodapp deployed Build .522 (619 public files, exit 0). GET /pos/users, /pos/, /cashier/ HTTP 200 loading JS index-q1xQGsY6.js; local/live sha256 a345bb3f47de91bcaee3d9479e4ee44899577fa150fcf081bd7ba12a1b80f32a match; local/live POS Users CSS sha256 f56e26971326a8c1815c05b68d5bdf329c4335cd57962453cc3c52df80f825fd match; unchanged shared toast-global-policy.css sha256 9eb4e866ec52dc01d59f153b0a47e9f4080cdd37ee7eb6bd01042cb15a5059d9 match. No Functions/Rules, real Firestore role writes, authenticated save test, Git commit/push/main merge. Preserve historical 19 untracked Vite bundles plus current .522; after user visual acceptance, commit/push/merge only when explicitly approved. Bump Build before subsequent Hosting deploy.

## 2026-10-18 — POS Users action icons, toggle colors, role-save Toast (Build .521)

- User screenshot /pos/users identified four issues: buttons missing semantic icons, icons touching text/not Y-centered, Select all and Clear all both green, role-save no Toast.
- Mac online, feature/react-firebase-port baseline bed69c14, origin 0/0, tracked clean; 19 historic hashed Vite bundles preserved.
- Root cause: PosUsersPage lacked leading Bootstrap icon markup on multiple text action buttons, group toggle CSS had no icon-label gap or distinctive state colors, saveRoles awaited Firestore write but gave no success notification.
- Added icons to Create/Delete/Save Role and Add/Edit/Save User/Cancel, accessible dialog close. CSS uses centered inline-flex gap 9px and distinct green Select all/red Clear all, protects hidden delete. Save Role shows success Toast only after awaited Firestore save, error Toast for failures/empty names, auto-dismiss 3sec. Five locales translated. No permissions/data changes.
- Tests: new pos-users-buttons-toast.spec.mjs 4/4 PASS; new Chrome browser fixture pos-users-button-layout-browser.spec.mjs 2/2 PASS at 390 and 1280px, verifies gap >=7px and Y error <=1px plus color/hidden behavior. Full npm run test:react-parity, build:react, verify:react-build PASS.
- Production LIVE: Firebase Hosting-only deploy on chat-45754 hosting:foodapp succeeded, 618 public files, exit 0. /pos/users, /pos/ and /cashier/ HTTP 200 load /react/assets/index-BlPn4kIF.js; JS live/local SHA-256 eb72ee202f1ee0f25219c807e1bd28831e75cce4b96146e7efa1666ea12480ad, live/local retail-pos-users-visual-dashboard.css SHA-256 b443f8bb91e5a61cb69fd1ce6ed90e8a4aa9c2883cae9d62ca25f04f214b8982 (both exact matches). No Functions, Rules, real tenant/role writes, authenticated role-save test, Git commit/push/main merge. Preserve 19 historic untracked hashes plus current generated .521; bump Build before next Hosting deployment and ask user to hard-refresh /pos/users and test save-role Toast after successful role save.

## 2026-10-17 — User-authorized Commit/Push/Fast-forward main merge (revenue slips + bank picker .520)

- User explicitly authorized Commit, Push and Merge into main after Hosting release .520. On authorized Mac, feature/react-firebase-port and origin/main both began at 062c7ac8; tracked worktree had only the approved zero-balance Revenue Share notice, lazy receiver-bank React UI, 5-locale translations, tests, current Build .520 and corresponding docs. 19 historic untracked Vite-hashed JS bundles preserved without clean/reset.
- Pre-merge validation: git diff --check PASS; npm run test:react-parity PASS; npm run verify:react-build PASS (Version 0.4.290 Build 2026.10.17.520, asset index-Bd9axu6x.js); 4/4 focused unit regressions PASS and 2/2 real Chrome browser desktop/mobile bank picker tests PASS. No authenticated financial transfer, bank-setting mutation, tenant order or live payment performed.
- Staged only tracked work, 4 new React component/test/fixture files and the current Build .520 hashed asset; kept all 19 historic Vite hashed JS files untracked. Commit 634c78a4 (fix: explain zero-due revenue slips and add lazy bank picker) pushed to origin/feature/react-firebase-port (0/0, tracked tree clean).
- Fetched remotes, git switch main; git merge --ff-only feature/react-firebase-port; git push origin main successfully advanced origin/main 062c7ac8 -> 634c78a4, with no conflict, 0/0 and proper merge ancestry. Docs-only audit commit to be pushed to main and Fast-forward synchronized to feature/react-firebase-port; Mac checkout returned to feature. Verify final tips after syncing.
- Firebase Hosting Build .520 was already deployed and validated before Git merge; NO extra Hosting/Functions/Firestore Rules deploy, no Build bump, and no database writes during merge.

## 2026-10-17 — Revenue Share zero-due slip explanation + Platform lazy bank picker (Build .520)

- User supplied two screenshots: /reports/revenue-share shows a slip already selected but submit button disabled with Platform amount due 0.00 THB; /platform shows a native 35-item bank select for the Slip2Go receiver. Mac mini initially offline but subsequently online and code inspected on feature/react-firebase-port. Tracked tree clean at baseline commit 062c7ac8, 19 historical untracked Vite hashed JS files preserved.
- RevenueShareReportPage.jsx condition already required platformAmountDue > 0 and billing-cycle match. When 0 due, it used to allow picking a file without any explanatory message. Added clearly localized no_amount_due notice (TH/EN/MY/LO/KM), disabled file picker for unpayable periods, and guarded submit handler before upload. Existing backend function still rejects unsupported cycles/amounts; no financial arithmetic, eligibility, actual transfer/payment or database writes changed.
- PlatformPage.jsx originally used an HTML select that rendered all 35 translated Slip2Go bank options; despite old existing receiver_search_placeholder translation, it had no search or lazy UI. Added independent React PlatformReceiverBankSelect component: searchable name/code, 12-item incremental list by scroll or More button, active keyboard navigation/Enter/Escape, outside click, mobile layout, and exact existing receiver accountType code on selection and save. No jQuery/Select2 bridge and no new backend/permission dependency. CSS in react-app/public/parity/css/platform-control-center.css; added the two localized labels in 5 languages.
- Tests: new tests/react-parity/revenue-share-payment-platform-bank.spec.mjs 4/4 PASS (zero due guard, form states, bank codes, locale labels), tests/react-parity/platform-receiver-bank-browser.spec.mjs 2/2 PASS with real React component and installed Chrome at desktop/mobile 390px (search/keyboard/list paging/scroll/name codes/no overflow), npm run test:react-parity PASS, npm run build:react and verify:react-build PASS. Version 0.4.290 Build 2026.10.17.520, JS /react/assets/index-Bd9axu6x.js.
- LIVE: Hosting-only deploy project chat-45754 target hosting:foodapp succeeded (617 public files, Deploy complete; exit 0). Production /reports/revenue-share, /platform and /cashier/ HTTP 200 all reference /react/assets/index-Bd9axu6x.js, local and live SHA-256 3abf78452d5ed1ebd123693a3629d9da9a4b4211ec5c44e5df83262636b19512 match. Live platform-control-center.css SHA-256 2394d52b482860d51abfa17004502e600fbbb30061428dcf3532accad2382d50 matches local. No Cloud Functions, Rules or tenant/payment data touched; no new test payment or bank settings save. Git changes remain uncommitted and unpushed by design; preserve all 19 historical untracked hashed bundles plus current generated Build .520. Ask user to hard-refresh both pages to confirm live UI and bank selection, and request explicit approval separately for Commit/Push/Merge. Bump Build before another Hosting deploy.

## 2026-10-16 — User-approved Commit/Push/Fast-forward main merge (Verify gift i18n .519)

- User explicitly authorized committing, pushing and merging the previously deployed Build .519 VerifyPage gift-suffix localization into main. Remote main and feature were both at 3e777250; feature worktree had only the planned Verify changes and 20 untracked hashed bundles (19 historical, 1 new release).
- Revalidated npm run test:react-parity PASS, verify:react-build PASS (Version 0.4.289 Build 2026.10.16.519, JS index-CfGyCfar.js), focused verify-page-i18n regression 3/3 PASS, git diff --check PASS.
- Staged only tracked changes plus new tests/react-parity/verify-page-i18n.spec.mjs and current public/react/assets/index-CfGyCfar.js; old 19 hashed JS assets left untracked, never cleaned or reset. Implementation commit f74d3ef5 (fix: localize free-gift label on public order verification) pushed to origin/feature/react-firebase-port; remote feature synced 0/0 and tracked tree clean.
- git switch main; git merge --ff-only feature/react-firebase-port; git push origin main succeeded (3e777250 -> f74d3ef5), no conflict, main/remote synced 0/0. A small docs-only audit commit now records the merge and will be synced back to feature, returning the Mac checkout to feature/react-firebase-port. Check both final refs and preserve old untracked bundles.
- Hosting 0.4.289 / Build 2026.10.16.519 was already deployed and live-verified on public /verify; no Hosting redeploy, Cloud Functions, Firestore Rules or tenant/order mutations performed as part of Git merge.

## 2026-10-16 — Public Verify page raw gift translation key repair (Build .519)

- User screenshot of /verify mobile showing a free-gift food line with the raw translation key verify.gift_suffix. VerifyPage.jsx already invokes this key, but all TH/EN/MY/LO/KM dictionaries lacked its definition. Other status, payment and net total texts were localized. The short order reference is the intended customer-facing receipt number, not leaked database internals.
- Added verify.gift_suffix to all five locale blocks in react-app/src/i18n/parity-translations.json using matching cashier.items.gift_suffix text, without changing original translations, item/payment logic, or database.
- New tests/react-parity/verify-page-i18n.spec.mjs checks all static Verify keys in five languages, gift text, unchanged order reference/amount/status contracts: 3/3 PASS. npm run test:react-parity PASS; npm run build:react and verify:react-build PASS, Version 0.4.289 Build 2026.10.16.519 JS index-CfGyCfar.js.
- Production LIVE: Hosting-only foodapp target project chat-45754 released successfully, 616 public files, CLI exit 0. /verify, /cashier/ and /delivery/ HTTP 200 load index-CfGyCfar.js, local/live SHA-256 c959104ccd0b93f54fa4a85395a4ed2ff82545ad6f25d8bf95dcaada1205edc0 match. Real public customer verify link tested in headless local Chrome at 440x956 viewport: item shows the Thai text ลูกชิ้นหมู (ของแถม), six rows displayed, no raw key or horizontal overflow; no order changes. No Cloud Functions, Rules or data changes. Do not commit/push/merge unless separately requested; preserve 19 previous untracked hashed bundles and the new release bundle. Next Hosting deploy must bump Build.

## 2026-10-11 — User-authorized Commit/Push/Fast-forward main merge (iOS voice .518)

- User confirmed the Cashier/Kitchen icon-only header and Thai iOS voice behavior and explicitly requested commit, push and merge to main. Prior voice support Build .517 and header compactness Build .518 had been deployed to Hosting but remained uncommitted in Mac working tree.
- Fetched remote main and feature/react-firebase-port. origin/main db935940 was direct ancestor of origin/feature/react-firebase-port c1022d0f (1 commit ahead, no divergence); untracked old bundle path collision check found none.
- Re-ran npm run test:react-parity, npm run verify:react-build and Playwright iPad-like browser audio test; all PASS. Current production Version 0.4.288, Build 2026.10.11.518, bundle public/react/assets/index-xr95bypR.js. No Hosting redeploy or Build bump needed just for merging.
- Staged and committed all pertinent React source/UI, 27 GPL-compatible eSpeak NG Thai WAV clips and manifest, test scripts, iOS regression/browser test, generated 518 React bundle and entrypoints, README, Handoff and Worklog as implementation commit 78d67e4d; pushed origin/feature/react-firebase-port (0/0). Preserved all 19 previous untracked Vite hashed bundles, including the older Build .517 generated output.
- git switch main; git merge --ff-only feature/react-firebase-port; git push origin main succeeded. Remote main advanced db935940 -> 78d67e4d and main was clean, with no merge conflict.
- Post-merge docs-only audit commit synchronized to main and feature, then returned local checkout to feature/react-firebase-port. Both tips/remote tracking should be checked for 0/0. No Cloud Functions/Firestore Rules/Hosting redeploy, live orders or tenant mutations; existing prod Build .518 remains unchanged.

## 2026-10-11 — Compact Cashier/Kitchen header voice status (Build .518)

- User supplied a live Cashier screenshot and confirmed Thai spoken voice now works, but status text "เสียงพูดไทยจากอุปกรณ์พร้อมใช้งาน" appears visibly beside the bell, wasting horizontal space.
- Root cause: CashierOrderNotifier.jsx rendered a span with class sr-only and voiceLabel as a third child of its flex toolbar row, but .sr-only CSS was scoped to waiting-queue.css (not loaded by Cashier/Kitchen). The text rendered as visible flex content.
- Removed only the extra span. Both test-voice and bell icon buttons remain with existing aria-label/title readiness metadata, indicator dot, click behavior and audio unchanged. Shared fix affects Cashier and Kitchen.
- Focused regression 7/7 PASS, full npm run test:react-parity PASS, npm run build:react and verify:react-build PASS. Version 0.4.288, Build 2026.10.11.518, bundle index-xr95bypR.js.
- Hosting-only Build .518 LIVE: Firebase project chat-45754 target hosting:foodapp/penguin-food, successfully released 615 public files, exit 0. /cashier, /kitchen/, /cashier/quick-order HTTP 200 all reference /react/assets/index-xr95bypR.js; local/live SHA-256 ea47f37cdcd0fd6ec9a1119ac67b282d2d8ff8865e8e14b99c0deb2a9a5d3e5a match. No Functions/Rules changes or tenant/order mutations. Git commit/push/merge not requested; keep Build .518 and older .517 voice changes uncommitted in working tree. Preserve historic untracked Vite assets, bump Build for subsequent Hosting deploy. User should hard refresh Cashier/Kitchen to verify icon-only toolbar.

## 2026-10-10 — iOS spoken order notifications via WebAudio fallback (Build .517)

- User confirmed iPad can play PENGUIN order chime but not Thai spoken announcements, then approved a robust fix for Cashier/Kitchen: direct-gesture Web Speech unlock, Thai voice readiness, locally hosted recorded speech fallback and a test-speech button.
- The CashierOrderNotifier still respects old order eligibility / Kitchen payment admission and sequential announcement queue, but now additionally subscribes to real chime vs spoken readiness and has a 36px test voice action with status dot/accessible text. Actual testVoice() calls SpeechSynthesisUtterance.speak() synchronously within tap, with Thai voice selection and failure/timeout detection. Automatic arm keeps chime but does not claim voice ready until audio assets decode (recorded) or speech starts (Web).
- New orderAlertRecordedAudio.js composes spoken Thai phrase and money in baht/satang from 27 local WAV segments via AudioBufferSourceNode in the unlocked AudioContext. iOS uses this recorded fallback until on-device Web Speech has really started in a user gesture; macOS uses native Web Speech first, then fallback on failure. The voice sample assets were generated with **open-source eSpeak NG 1.52 th**, not macOS Kanya, whose system voice audio cannot be redistributed for a commercial SaaS. Files/manifest in public/assets/audio/order-alert-th; provenance and license included. Synthetic eSpeak is more mechanical-sounding than Mac voice, but is usable when Safari Speech API remains silent.
- Local tests: ios-order-alert-audio.spec.mjs 6/6 validates Thai money reading, assets, iOS detection, voice-test UX and original Kitchen/Cashier eligibility. ios-order-alert-browser.spec.mjs iPad-like UA in desktop Chrome (1/1) tests actual WebAudio audio file fetching/decoding and playing an order for 170 baht. Full React Parity PASS; Vite build and generated contract PASS (Version 0.4.287 Build 2026.10.10.517, bundle index-CgDx6yit.js).
- No real physical iPad/iPhone Safari test is possible from remote Mac; user acceptance necessary for first-tap test, speaking orders and volume/quiet mode. Locked/background iOS browser still cannot guarantee speech, per platform policy.
- Hosting-only Production release deployed: Firebase project chat-45754 target hosting:foodapp/penguin-food, successful release (614 files, exit 0). /cashier/, /kitchen/ and /cashier/quick-order/ HTTP 200 reference /react/assets/index-CgDx6yit.js, identical SHA-256 locally and live f797205a705214c1483a5e115280eff7dd6134f15a7e720668ecd9cefe94e310. Sample live WAVs and manifest verified HTTP 200 and exact local hashes. No Cloud Functions/Firestore Rules or tenant/order writes. User explicitly authorized repair but did NOT ask to commit/push/merge; current source/assets/docs changes are still uncommitted and unpushed. **Preserve them; do not git reset/clean.** Retain 17 historical untracked bundles and the new generated bundle. Need real iPad/iPhone Safari foreground audio user acceptance, then commit/push only on explicit request; bump Build before any further Hosting deploy.

## 2026-10-10 — Authorized main Fast-forward merge (Quick Order customer display)

- User confirmed the restaurant-only Quick Order customer display is working after deploying production Firestore Rules, and explicitly requested Commit, Push, Merge. Both implementation 9228f0f6 and deployed-Rules documentation 789dd438 were already committed and pushed on feature/react-firebase-port.
- Fetched both remotes; origin/main a5420d1e was a direct ancestor of origin/feature/react-firebase-port 789dd438 (4 commits ahead, 0 divergence). Tracked worktree clean; 17 previous untracked hashed React bundles preserved.
- Re-ran npm run test:react-parity and npm run verify:react-build; both PASS for Version 0.4.286 / Build 2026.10.10.516.
- Per authorization executed git switch main, git merge --ff-only feature/react-firebase-port, git push origin main. Remote main Fast-forwarded a5420d1e -> 789dd438, no merge conflicts.
- Added this audit to NEXT_CHAT_HANDOFF and WORKLOG as a docs-only follow-up commit on main; synchronized that commit back onto feature/react-firebase-port and returned the local checkout to feature branch. Both branches should track the same tip, confirmed by final Git checks.
- Production Hosting Build .516 and scoped Firestore Rules were deployed before merge, so NO extra Hosting/Rules/Functions deployment was performed. No Firebase build bump, live order or tenant mutations, main merge conflict, reset/clean or discarded assets.

## 2026-10-10 — Restaurant-only Quick Order customer-display permissions (Rules deployed)

- User screenshot of /cashier/customer-display?displayId=quick-order-* showed 0 items and blank totals for restaurant_cafe-only tenant. Root cause: both QuickOrderPage updateCustomerDisplay and customer page watchCustomerDisplay target tenants/{tenantId}/customerDisplays/{displayId}; Firestore Rules restricted reads/writes to retail_pos. Existing shipped React .516 already publishes correct snapshot and watches correct document.
- firestore.rules now additionally allows restaurant order_delivery single-doc get for quick-order-* IDs with tenant membership. Restaurant creates/updates only quick-order-* docs by authorized owner/admin/manager/cashier/super_admin roles, tenant payload match, document ID and register/display/id fields matching, tenantId/shopId matching, and <=100 cart items. No collection-wide list access for restaurant-only; retail POS read/write/delete unchanged; heldBills remain retail-only.
- Added quick-order-customer-display-rules regression 4/4, integrated npm run test:react-parity (all PASS), verify:react-build PASS for production .516; firebase-tools firestore:rules --dry-run on project chat-45754 compiled successfully, exit 0. Emulator not available because Java is not installed.
- LIVE: User explicitly authorized targeted Firestore Security Rules deployment. Deploy-only firestore:rules project chat-45754 exited 0; Firebase confirmed rules compiled, uploaded and released to cloud.firestore, then Deploy complete. Implementation commit 9228f0f6 is already pushed. No Hosting/Functions deployment, version/build changes, data writes or main merge. Next step: refresh both signed-in Cashier Quick Order and paired customer-display tab, put one item in cart, and check realtime items/totals; this authenticated end-to-end flow was not run by assistant. Keep historical untracked hashed bundles.

## 2026-10-10 — Restaurant-only Cashier Quick Order initial loading fix (Build .516)

- User screenshot of /cashier/quick-order with restaurant_cafe-only tenant showed "ยังไม่สามารถโหลดข้อมูลร้านค้าได้ กรุณาลองอีกครั้ง" and no menu. Root cause: loadOperationalSnapshot used Promise.all for settings, menus, tables, orders AND retail-only heldBills. firestore.rules permits heldBills reads only with retail_pos. Denial aborts the complete snapshot before menu/table/order callbacks.
- Core loadOperationalSnapshot now reads only restaurant-safe settings/menus/tables/orders, returning heldBills: [] to retain object shape. Retail-eligible Quick Order tenants keep their separate realtime heldBills listener and pause-bill UI; restaurant_cafe-only tenants skip the unauthorized listener and hide retail-only pause-bill controls. Cashier Table QR uses same safer core snapshot.
- Customer-display Firestore sync is separately restricted to retail_pos by existing rules and can still warn for restaurant-only tenants; solving that cross-device feature and enabling restaurant-only held bills requires separately scoped authorized backend/rules work if requested. This does NOT block core Quick Order menu/table/order data.
- New tests/react-parity/quick-order-restaurant-only.spec.mjs regression 4/4, including executing actual snapshot code with mocked Firestore rejecting heldBills. Full React Parity PASS; Vite React Build PASS and generated contract PASS; release Version 0.4.286 Build 2026.10.10.516, JS index-CRDhG3Ft.js. No Cloud Functions or Firestore Rules changed and no live tenant/order data mutated.
- Hosting-only repair LIVE: implementation commit 114101f6 pushed to origin/feature/react-firebase-port (synced 0/0); Firebase project chat-45754 hosting:foodapp/penguin-food successfully deployed (584 public files, exit 0). Production /cashier/quick-order, /cashier/table-qr, /kitchen/ and /cashier/ HTTP 200, all referencing /react/assets/index-CRDhG3Ft.js; remote/local JS SHA-256 f5f46637796057bc6c499cfccc36684deb9e80145f34d50e9b24c10187dee5d9 match. No main merge, Cloud Functions, Rules or live tenant/order writes. Keep historical untracked hashed Vite bundles. Next Hosting deploy must bump Build; authenticated restaurant-only Quick Order workflow acceptance still pending.

## 2026-10-10 — User-authorized Fast-forward merge to main (Delivery heading .515)

- User confirmed the Delivery shipping brand alignment is correct and expressly authorized commit/push/merge. Feature implementation 9add2da9 and production documentation 8b95b207 were already committed and pushed to origin/feature/react-firebase-port.
- Fetched origin/main and origin/feature/react-firebase-port; confirmed origin/main bafbaa95 is a strict ancestor of origin/feature/react-firebase-port 8b95b207 (2 commits ahead, 0 diverged). No tracked local edits; 16 historical untracked public/react/assets/index-*.js kept.
- Re-ran full npm run test:react-parity and npm run verify:react-build: both PASS for release 0.4.285 / 2026.10.10.515, bundle index-KNQYF0SH.js.
- Used git switch main; git merge --ff-only feature/react-firebase-port; git push origin main. Fast-forward bafbaa95 -> 8b95b207 confirmed, no conflict.
- The resulting documentation commit was recorded on main and synchronized back to feature/react-firebase-port, after which both branch tips and their origins match. Returned local checkout to feature/react-firebase-port.
- Release .515 was already deployed and production-smoke-verified prior to merge. NO additional Firebase Hosting or Cloud Function deploy, no Build bump, Firestore changes or Bundle deletion.

## 2026-10-10 — Delivery shipping header brand alignment (Build .515)

- User supplied mobile Chrome screenshot of /s/aui-bau-traditional-thai-coffee/delivery with the "ข้อมูลจัดส่ง" heading. The icon tile beside the heading is StoreBrandMark (uses shopLogoUrl/logoUrl when available; otherwise standard storefront fallback), not a stray injected image. User requested X/Y centering and spacing to the heading text.
- DeliveryPage adds delivery-shipping-title and delivery-shipping-title-row classes only around that heading. store-hero-branding.css now sets a local 42px centered circular logo tile (38px at <=480px), grid place-items:center, center-fitted image (object-position 50% 50%), centered fallback icon, and column gap 14px / 12px on mobile. Large hero logos, other section headings, tenant image selection and behavior unchanged.
- Added static regression (2/2) and actual Chrome Browser CSS layout tests 6/6 (logo/fallback at widths 320,440,1280), measuring centered axes, label gap and no overflow. Full npm run test:react-parity PASS; npm run build:react and verify:react-build PASS, release Version 0.4.285 Build 2026.10.10.515, index-KNQYF0SH.js.
- Hosting-only release LIVE: implementation commit 9add2da9 pushed to origin/feature/react-firebase-port (0/0). Firebase project chat-45754, target hosting:foodapp/penguin-food deploy completed with 583 public files, exit 0. Production /s/aui-bau-traditional-thai-coffee/delivery, /delivery/ and /cashier/ HTTP 200 reference /react/assets/index-KNQYF0SH.js. Production/local JS SHA-256 c0af5f4870c8c9d5d3529130d7f3ee90475a01dd6f4eda69e0e7a236b9fbe1a7 and CSS SHA-256 2d4324c5f02b4e98c81c3783780cb1a6dedbfdc64297bd10d71a46335e361795 match. Do not merge main without user permission; no Cloud Functions or Rules changed and historical old untracked hashed JS files untouched. Bump Build before next Hosting deploy.

## 2026-10-10 — User-authorized main Fast-forward merge

- User confirmed Cashier net-total UI is correct and explicitly requested Commit, Push and Merge. Preflight fetched both branches and confirmed origin/main (98c07f6e) is an ancestor of origin/feature/react-firebase-port (1944dc60), 9 commits behind, with no local tracked changes; 16 previous untracked Vite hashed JS files were preserved.
- Re-ran npm run test:react-parity and npm run verify:react-build; both PASS (0.4.284 / 2026.10.10.514). Switched to local main, merged feature/react-firebase-port with git merge --ff-only and pushed origin/main from 98c07f6e to 1944dc60; no merge commit and no conflict.
- Post-merge documentation commit recorded on main and both main/feature branch tips synchronized (see git log). Firebase Hosting was already deployed and Production verified before this merge; no redeploy, no version/build bump, no Functions or Firestore Rules deployment. Keep working on feature/react-firebase-port and preserve historical untracked bundles.

## 2026-10-10 — Cashier bill modal net total wording (Build .514)

- User supplied real Cashier Delivery bill screenshot: modal grand total label incorrectly read "ยอดรวมทั้งโต๊ะ" because it reused cashier.table.total across every order type. Change only label selection: Delivery, Take Away and Walk-in show "ยอดรวมสุทธิ" (cashier.bill_preview.net_total), table rounds retain table-specific label. Total numeric sum and calculation unchanged.
- Added net_total translation to five Cashier bill-preview locales. Regression tests include branch-specific label check and exact Thai wording. Full React Parity and generated Vite Build PASS. Version 0.4.284 / Build 2026.10.10.514; bundle /react/assets/index-hXz-nnu4.js.
- Hosting-only release LIVE: implementation commit b4a7886f pushed to feature/react-firebase-port and hosting:foodapp deployed on Firebase project chat-45754 (582 public files, exit 0). Production /cashier/, /cashier/receipt/, /kitchen/ HTTP 200 reference /react/assets/index-hXz-nnu4.js. SHA-256 of live and local JS matches: 4861d54b9c851f47aa845dad425922753768036bec40b6f2c595aa3195d800a8. No Cloud Function, Rules, tenant/payment/order writes, no main merge, and historical untracked Vite bundles retained. Bump Build before next Hosting deploy.

## 2026-10-10 — Cashier modal bill preview and print loader typography (Build .513)

- User screenshot highlighted orange eye action on /cashier in Delivery card; previously view_slip opened a separate browser tab. It now opens an in-page, accessible scrollable bill-details modal (receipt items, customer/address, payment state, amounts, inline uploaded slip) using shared Cashier styling. Also added "View bill" eye action for Take Away, Walk-in and Table bill groups, preserving separate Print button and all payment/cashier/Kitchen gates.
- Receipt print tab waiting screen removes center PG PENGUIN mark while retaining spinner and status. Uses actual shared Kanit Local font files and matching fallback; Thai receipt-preparation message exactly "ระบบกำลังเปิดหน้าพิมพ์ใบเสร็จ กรุณารอสักครู่..." (the primary status heading remains).
- Added modal close X, close footer action, backdrop / ESC dismiss, focus return and scroll containment. Localized bill preview TH/EN/MY/LO/KM. No Firebase API, Cloud Function, Rules or live tenant data changes.
- Tests: bill modal static regression 4/4, receipt loader unit 7/7, full npm run test:react-parity PASS, Chrome CSS modal widths 320/440/1280 PASS, Chrome actual loader 390/1280 PASS, Vite Build and generated contract PASS. Release candidate Version 0.4.283 / Build 2026.10.10.513, JS /react/assets/index-DHwYQlC7.js.
- Production Hosting deployed: implementation commit a73fdc3b pushed to feature/react-firebase-port; hosting:foodapp project chat-45754 succeeded (581 files, exit 0). Live /cashier/, /cashier/receipt/ and /kitchen/ HTTP 200 reference index-DHwYQlC7.js. Production JS SHA-256 f35bf105dd77c9612077d385adb0b5a02c8eb888cb2ec6f54a3913beb5db29d1, CSS SHA-256 75ba92dce63f6d39dedbb351f5c74dc37318e3d0aa1325f5a0d6f56c7a0ade08, both match Mac. No Cloud Functions or Rules deployed, no main merge or old hashed bundles deleted. Bump Build before next Hosting release and test authenticated cashier with a safe real order.

## 2026-10-10 — Cashier print-tab blank-page repair (Build .512)

- Cashier confirmation created window.open('', '_blank') before awaiting approveDeliveryPaymentReview. The empty tab appeared white for 5–10 seconds while the backend verified payment. The payment gate and Kitchen release were working; this was an uninitialized print-tab UI.
- New utility react-app/src/utils/receiptPrintWindow.js synchronously fills the script-opened tab with a centered, branded, accessible loading UI, then updates status when opening the receipt. CashierPage uses it for single/order and table payments. On payment failure the tab is closed; if popups are blocked or cannot be initialized, original same-tab receipt navigation fallback remains. Receipt auto-print and Slip2Go/Cashier payment approval rules unchanged.
- Loading and preparing messages localized TH/EN/MY/LO/KM. Regression tests: Node unit 6/6; installed Chrome real popup at 390px and 1280px 2/2; full React parity PASS; Vite Build PASS and generated artifact /react/assets/index-Bm69FZDi.js verified for Version 0.4.282 / Build 2026.10.10.512.
- Production deployed: Implementation commit 6fe6c9ac pushed to feature/react-firebase-port (synced 0/0); Hosting-only target foodapp (penguin-food) project chat-45754 returned Deploy complete (580 files). Live /cashier/, /cashier/receipt/, /kitchen/, /delivery/ HTTP 200 all point to /react/assets/index-Bm69FZDi.js, same SHA-256 locally and in Production (b0a363a69a78c280ab12e400117c0c5181940206b00f272dfdc30e4bc01222c6). No Functions or Rules deployed. Preserve historical untracked hashed bundles; do not merge main. New Build required before next Hosting deploy. Actual authenticated manual cashier approval and printer validation still pending user acceptance.

## 2026-10-10 — Delivery payment toggles / Kitchen loader repair (production deployed)

- User clarified self-delivery with PromptPay prepayment, Slip2Go auto verification and cashier manual review during provider downtime; COD must remain available as an optional per-store method. Existing Slip2Go and authorized cashier release rules remain unchanged.
- Current changes on feature/react-firebase-port: Admin adds deliveryPromptPayEnabled and deliveryCodEnabled stored in tenants/{tenantId}/settings/store. Missing flags default to true for legacy shops. Cannot save both off. Delivery live settings show only enabled options and validate before checkout. submitPublicDeliveryOrder independently rejects disabled options inside the store-open Firestore transaction. Kitchen uses loadKitchenMenus for settings+menus plus orders listener, no read of Retail POS-only heldBills, and separates the two error states.
- Regression: test:delivery-server-guard covers all enabled/disabled combinations; test:delivery-slip2go maintains trusted payment gate; Kitchen scope tests added; full parity/build status in WORKLOG.
- User authorized production release. Implementation commit 7ab83f48 is pushed. Version 0.4.281 / Build 2026.10.10.511 is LIVE in Firebase chat-45754: Cloud Function submitPublicDeliveryOrder (asia-southeast1) and Hosting foodapp/penguin-food deployed successfully. Production /admin/, /delivery/, /kitchen/ and /cashier/ returned HTTP 200 using /react/assets/index-PV9uUcY7.js; remote and local bundle hashes match. Live tenant/order/payment data unchanged during smoke. A new Build is required before any subsequent Hosting deploy.
- Do not merge main unless requested; do not remove prior untracked hashed JS bundles.

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
## Latest: User-authorized feature -> main Fast-forward Merge (2026-10-09)\n\n- Authorized user request: commit/push/merge all 477 commits from feature/react-firebase-port to main. Original origin/main `013fd5ad` is ancestor of feature `67ad1f9d`, so exact tree Fast-forward successful in separate clean temporary main worktree; no conflicts. No production redeploy was required because Build `.510` was already live.\n- Preflight passed Operational 7/7, full React Parity, generated-build contract and git diff --check. 16 old untracked generated hashed JS bundles in original Mac feature worktree kept intact.\n- Added docs-only integration note on top of merged main and will sync this commit back to feature. Main/feature remote refs should be verified after final pushes. See WORKLOG.\n\n## Latest: Three coordinated delivery address icons — Build 2026.10.09.510

- User rejected previous visually dense hand-drawn icons and instructed assistant to implement a clean alternative for the three address controls Add, Edit, Delete. Mac-direct feature branch implementation.
- `DeliveryCustomIcons.jsx`: matching open-stroke Lucide-style Plus, Pencil, Trash2 SVGs (24x24 viewbox, 1.9px strokes, round caps/joins, no filled artwork). `DeliveryPage.jsx` uses same Plus in Add header and no-selection notice, preserves Edit/Delete actions/aria-labels. `delivery-addresses.css` redesigns icon-only Edit/Delete actions as understated sage/blush backgrounds without heavy borders; card stays 62px Mobile /66px PC, icons centered and separated 9/10px. No changes to GPS, cart, checkout, Hero or backend.
- Build 2026.10.09.510 main JS `/react/assets/index-Bjs7TiRD.js`. Address UI 17/17, GPS integrity 12/12, Operational, full React parity, Vite build/generated contract PASS. Actual compiled Mac Chrome guest GPS delivery at 320px Add/Edit dialogs open and close correctly, icons centered and no overflow. Further 360px real fixture failed while awaiting Firebase profile, so separate compiled-CSS + exact SVG DOM smoke at 320/360/390/440/768/1280 PASS with no horizontal overflow and zero center offset. Script `tests/react-parity/delivery-icon-triad-css-smoke.mjs` retained for future regression.
- PRODUCTION VERIFIED: implementation commit `238de3c0` pushed to feature/react-firebase-port (0/0), Hosting-only foodapp project `chat-45754` released Build `2026.10.09.510` (577 files). Live Delivery/Admin/Cashier/Kitchen pages HTTP 200 reference `index-Bjs7TiRD.js`, live JS and delivery-addresses.css byte-identical to Mac; previous `.509` bundle preserved. Actual Chrome Production CSS+SVG viewport fixtures 320/360/390/440/768/1280 ALL PASS: 17px Plus, 18/19px Edit/Delete, icon center deviation 0px, action gaps 9/10px, cards 62/66px and no page overflow. Real local React 320px Guest browser Add/Edit modal open/cancel PASS. A 360px real Firebase-backed guest fixture sometimes timed out loading a profile, so functional six-width test is not claimed. No Functions/Firestore/Storage Rules or live tenant/order/customer writes, main merge/reset/clean or old hashed bundle removal. See WORKLOG.

## Latest: Round store logo + Admin drag-to-focus cover for all four order surfaces — Build 2026.10.09.509

- User approved a large **circle logo nearly the Hero height** (NOT the width), upload help square 1200×1200 logo and landscape 1600×900 cover (PNG/JPG/WebP max 8MB), and per-shop cover focus selection by dragging a marker. Shared across Delivery, Table Order, Takeaway, Cashier Quick Order.
- `store-hero-branding.css`: responsive circular shop logo 76px @320, 88px phone 360-440, 112px desktop, white ring/shadow and separate text column, no title overlap. `StoreHeroBranding.jsx` now applies focus-aware backgroundPosition from `storeHeroFocus.js` to all four surfaces, centering old stores at 50/50.
- `StoreBrandingEditor.jsx` Admin cover UI: drag source image target (actual pointer capture and touch), keyboard arrow +/-2% (Shift 10%), Home/reset center, visible marker, coordinates, live crop preview. AdminPage.jsx persists and verifies `shopHeroFocusX/Y` with existing tenant store settings save, resets focus when cover replaced/removed. 5 locale texts for recommended dimensions, max 8 MB and focus UI. No backend/Storage Rules changed and no tenant image uploaded by tests.
- Build 2026.10.09.509, new JS `/react/assets/index-DcBPBVN_.js` (Version 0.4.280 unchanged). Unit focus 6/6 and existing brand 6/6, full Operational/React parity/build PASS. Real compiled Chrome viewport smoke on phone/tablet/desktop PASS, no horizontal overflow. Actual React Editor Vite-only test passed mouse drag, touch tap, keyboard and reset on 320/440/1280; temporary test harness safely removed. Cross-surface Hero fixture smoke validates logo/background in Delivery/Table/Takeaway/Quick Order structures.
- **PRODUCTION VERIFIED**: implementation commit `4769d38a` pushed synced 0/0; Hosting-only foodapp Build `2026.10.09.509` deployed (576 files). Production `/admin`, Delivery, Table Order, Takeaway, Cashier Quick Order, Cashier and Kitchen HTTP 200 reference JS `index-DcBPBVN_.js`; live JS and Hero/branding Admin CSS byte-identical to Mac. Chrome Production CSS fixture at 320/390/440/768/1280 PASS across all four Hero markup shapes with circular logo, saved crop focus (82/18 sample) and zero horizontal overflow. Real existing shop Delivery Production at 440/1280 PASS: circular logos 88/112px and old unset crop falls back 50/50. Browser did not wait for image decoding, so pixel display not asserted. Actual React Admin editor drag/touch/keyboard/reset passed locally on 320/440/1280 in a temporary Vite harness (now removed). Authenticated tenant upload/save not performed to protect existing store photos and settings. No Functions/Rules changes, tenant/customer/order writes, main merge/reset/clean, or old bundle deletion. See WORKLOG.

## Latest: Shop logo + Hero cover upload for Delivery/Table/Takeaway/Quick Order — Build 2026.10.09.508

- User rejected recolored scooter font and requested per-shop uploaded logo, an uploaded shop-related Hero cover in admin Store Settings, and the same customization for dine-in Table Order, Takeaway and Cashier Quick Order. Continued direct Mac development without further permission prompts.
- StoreHeroBranding.jsx + store-hero-branding.css render per-tenant `settings.shopLogoUrl`/`shopHeroImageUrl` (legacy logoUrl/heroImageUrl read support), dark overlay and `background-size:cover` all 4 pages; Delivery section heading also shows logo, never previous scooter. Missing image gracefully falls back to shop glyph and original green gradient.
- StoreBrandingEditor.jsx added under Admin Store Basics: browse/preview/replace/remove logo and cover; StoreBrandingData compresses JPG/PNG/WebP to WebP (alpha retained for logo), max 8MB original / 5MB uploaded, writes only on Store Save to existing tenant-scoped Storage rules `tenants/{tenantId}/product-images/store-branding/...` and saves URLs in tenant settings/store with read-back verification. Removes clear settings display links, not underlying bytes. No Storage/Firestore Rules changes/deploy. Labels localized TH/EN/MY/LO/KM. Real tenant uploads NOT tested and no real account/settings modified.
- Hand-drawn dedicated SVG Edit/Delete actions in DeliveryCustomIcons.jsx replace Bootstrap font glyphs; icon positioning retained 30px/33px tiles, address cards 62px mobile /66px desktop. Scooter-artwork code removed, old static tests updated.
- Build 2026.10.09.508 (JS /react/assets/index-BYxDosD9.js), React parity/operational/build and brand tests 6/6 PASS. Actual installed Chrome visual smoke with read-only logo/cover fixtures 320/360/390/440/768/1280 ALL PASS: responsive cover, mark/fallback, admin previews one vs two columns, centered Edit/Delete, no card/page overflow or runtime error, editor modal works. No order/payment changes.
- PRODUCTION VERIFIED: implementation commit `7f5b241b` pushed to feature/react-firebase-port synced 0/0; Firebase Hosting-only foodapp Build 2026.10.09.508 deployed (575 files), live `/admin`, `/s/.../delivery`, `/s/.../order`, `/s/.../takeaway`, `/cashier/quick-order`, `/cashier`, `/kitchen` reference new `index-BYxDosD9.js` and live JS/CSS bytes match compiled Mac. Production Chrome with isolated read-only Guest+image fixtures widths 320/360/390/440/768/1280 ALL PASS: Hero cover crop, logo/fallback, admin responsive 2/1-column preview, vector Edit/Delete actions, no overflow/page errors. No auth-user actual Storage upload or Firestore store-profile writes; a real shop admin must choose logo/cover and click Save. No Functions/Rules, live tenant/customer/order changes, main merge/reset/clean or prior hashed-bundle deletions. See WORKLOG.

## Latest: Delivery scooter and original Edit/Delete address button styling — Build 2026.10.09.507

- User explicitly requires Mac-direct implementation, not code suggestions. Requested new scooter emblem and restore original clear Edit/Delete icons to the compact saved-address cards.
- DeliveryPage.jsx header `bi-scooter` given `delivery-hero-scooter` class; Edit icon restored to `bi-pencil-square`, Delete remains `bi-trash3`; CSS scoped to Delivery uses mint/green centered scooter badge (34px Mobile, 38px PC), original subtle sage filled Edit and blush/red Delete icon tiles (30px Mobile, 32px PC). No change to callbacks or accessibility.
- Build 2026.10.09.507 generated JS `/react/assets/index-D0M1Jvri.js`. Focused address UI 15/15, GPS integrity 12/12, Operational, full React parity, Vite build/postbuild PASS. Actual compiled Mac Chrome 320/360/390/440/768/1280 PASS: new scooter green at correct size, action icons perfectly Y-centered, gap exactly 8px, cards retain 62px Mobile/66px PC, no overflow or page errors, Edit dialog still opens/cancels.
- PRODUCTION CONFIRMED: implementation commit `06e24109` pushed to feature/react-firebase-port (0/0). Firebase Hosting foodapp Build 2026.10.09.507 deployed (571 files); live Delivery/Admin/Cashier/Kitchen reference `index-D0M1Jvri.js`, live JS + delivery-addresses.css match Mac bytes, previous bundle preserved. Installed Chrome real Production tests at 320/360/390/440/768/1280 PASS: mint scooter badge 34/38px; Edit framed-pencil on sage, Delete bin on blush, action tiles 30/32px with center offset 0px and 8px gap; original 62/66px card heights intact; Edit modal opens, no JS errors/overflow. No Functions/Rules, real user/order writes, main merge, reset/clean or old bundle deletion. See WORKLOG.

## Latest: Delivery slip guidance wrap and confirmation receipt copy — Build 2026.10.09.506

- User supplied screenshot of Slip2Go guidance overflowing the card after slip upload at iPhone 440px, then asked to change the customer Delivery receipt's payment row to 'ชำระเงินแล้ว รอร้านตรวจสอบ' when pending, Lalamove area to 'จัดส่งโดย Lalamove', and item names to 'ตำข้าวโพดไข่เค็ม x 1'. Implement both as ONE Hosting-only release.
- DeliveryPage.jsx assigns the scoped `delivery-payment-slip-review-note` hook; payment-slip.css makes long guidance and unusual filenames wrap safely within the payment card. DeliverySuccessPage.jsx uses pure presentation helpers in react-app/src/utils/deliveryReceiptPresentation.js: pending verification label without mutating paymentStatus; confirmed-paid/COD labels unchanged; provider conditional Lalamove vs self; inline `name x qty`. Success receipt CSS prevents clipping longer item names. TH/EN/MY/LO/KM translations for pending copy and Lalamove.
- Build 2026.10.09.506 with bundle `/react/assets/index-BXZfwSp3.js`. Slip tests 16/16, new receipt helper 5/5, complete React Parity/Operational/build/postbuild PASS. Actual Chrome compiled local UI using *isolated read-only DOM fixtures* tested long mobile review note/filename 320–1280 and receipt statuses/quantities 320/390/440/768/1280, no clipping or page overflow. No actual payment or customer/order/profile writes. Slip payment backend, store hours, GPS selection unchanged.
- PRODUCTION CONFIRMED: implementation commit e461d32c pushed to feature/react-firebase-port synced 0/0; Hosting-only foodapp project chat-45754 deployed Build 2026.10.09.506 (570 files). Live Delivery, Delivery Success, Admin, Cashier, Kitchen reference JS index-BXZfwSp3.js and live JS/payment-slip.css/delivery-success-tracking.css bytes match Mac. Actual Chrome on Production with isolated read-only fixtures: slip review help+long filename 320/360/390/440/768/1280 PASS without overflow; receipt pending payment, Lalamove label and `ชื่อสินค้า x 1` at 320/390/440/768/1280 PASS without clipping. Unit/backend guards PASS. No Functions/Rules changes, customer/order/payment writes, main merge/reset/clean or historical hashed bundle deletion. Real signed-in customer/payment verification remains manual acceptance. See WORKLOG.

## Latest: Compact Delivery saved address cards / inline icon actions — Build 2026.10.09.505

- User explicitly requires implementation (not patch suggestions), matching compact mockup. Previous cards ~100px tall with action buttons on second row; desired cards 65–75px, radio/name left, Edit/Delete icons right, selected-delivery subtitle.
- React DeliveryPage.jsx: radio/title and selected-only translated subtitle left; icon-only accessible Edit/Delete controls right, plain secondary address count and compact Add on header. Same GPS <=100m saved-only policy, manual choice, map, payment and store-hour behavior. No Home default control reintroduced.
- Scoped delivery-addresses.css grid with flexible name + auto controls, cards 62px mobile / 66px desktop, inline icon actions with >=8px action spacing, green selected highlight. Text TH/EN/MY/LO/KM.
- Build 2026.10.09.505, JS /react/assets/index-DFL_FfeQ.js, Version 0.4.280 unchanged. Focused address UI 13/13, GPS integrity 12/12, Operational, full React parity, Build/postbuild PASS. Actual Chrome local compiled app at widths 320/360/390/440/768/1280 PASS, Edit modal works, manual selection overrides GPS, no overflow/page errors.
- PRODUCTION CONFIRMED: implementation commit 641ee56a pushed to feature/react-firebase-port 0/0, Firebase Hosting-only foodapp deployed Build 2026.10.09.505 (568 files), live /admin, Delivery, Cashier and Kitchen HTTP 200 and bundle index-DFL_FfeQ.js + address CSS exactly match Mac. Chrome Production isolated Guest/mobile 320/440/PC 1280 tests PASS: 62px mobile/66px desktop cards, 2 icon-only controls each, selected-only subtitle, add button aligned, edit modal working and no JS errors/overflow. No Functions/Rules, real customer writes, main merge/reset/clean, or old hashed asset deletion. See WORKLOG.

## Latest: Delivery uses GPS and manual saved addresses; no primary Home control — Build 2026.10.09.504

- User approved removing redundant Home/set-default button from Delivery saved-address cards because current delivery destination uses accurate GPS (only within <=100m of saved pin) or customer's explicit selection; out-of-range, denied GPS or no addresses never silently choose the legacy default.
- DeliveryPage.jsx: removed primaryAddressId, makeDefault() setter and Home buttons/UI. Compact card radio selection/Edit/Delete remain. No more default assignment to newly added address or promotion on delete. Existing legacy isDefault field on edited address is preserved exactly, without rewriting others; historical profile schemas/other app consumers unchanged. Manual selection always overrides auto GPS.
- Cleaned 17 dead Home-only CSS rules in delivery-addresses.css, freed label card width. No other UI/map/checkout/backend logic touched.
- Build 2026.10.09.504, JS /react/assets/index-mpUULFMy.js. Targeted address UI 11/11, GPS integrity 12/12, Operational, React full parity, server guard, build/postbuild PASS. Installed Chrome local six scenarios (320/390/440/1280, GPS near/far/denied, no addresses, explicit override, old metadata on edit) PASS. No Production customer/profile/order/payment writes.
- PRODUCTION VERIFIED: implementation commit af90b484 pushed to feature/react-firebase-port synced 0/0. Hosting-only foodapp project chat-45754 deployed Build 2026.10.09.504 (567 files), /react/assets/index-mpUULFMy.js and live Delivery CSS byte-identical to Mac. Production Chrome isolated Guest/GPS smoke PASS: far saved address 320px unselected with warning, iPhone 440 nearest saved address selected, PC 1280 nearest selected, denied GPS 390px unselected and warned; all 0 Home buttons, Edit/Delete/radio present, no page errors/overflow, old profile flags unchanged. No Functions/Rules or real customer/order/tenant data writes, no main merge/reset/clean or previous hashed bundle removal. See WORKLOG.
## Latest: Floating favorite-style Home icon and saved map help wrapping — Build 2026.10.09.503

- User's mobile screenshot requested a Home control visually like the transparent floating product favorite heart, plus repairing long "ตำแหน่งจัดส่ง" saved map help text spilling outside the card.
- Actual 320/440px Chrome baseline showed saved map help forced nowrap at ~473.8px width while map card header was only 236/356px. Scoped `#deliveryLocationPicker` CSS now makes that help wrap naturally to the card width, including translated long text. Does not modify the address-edit modal or map/geolocation behavior.
- Home default control CSS now matches favorite-style floating icon (transparent borderless 30x30px top-right; empty gray outline, selected solid green house), including keyboard focus and hover; remains single saved primary and does not alter selected checkout address. Product favorite button logic unaffected.
- Build **2026.10.09.503**, JS `/react/assets/index-BjEjutke.js`, Version 0.4.280. Focused address UI 10/10, Operational/full React Parity, Build/postbuild PASS. Actual compiled Chrome guest fixture at widths 320/360/390/440/768/1280 PASS: Home border 0, alpha transparent, 8px card inset; selected Home persisting uniquely; saved map description wrapping (mobile 37-56px height), no clipping/overflow, original checkout selection preserved.
- PRODUCTION VERIFIED: implementation commit `0b09de9b` pushed to feature/react-firebase-port 0/0, Firebase Hosting foodapp released Build 2026.10.09.503, 566 files. Live Delivery/Admin/Cashier/Kitchen pages use JS index-BjEjutke.js, bytes of JS and delivery address/map CSS match Mac. Production Chrome isolated guest/virtual GPS smoke at 320/440/1280px PASS: no saved-location help overflow, floating borderless transparent green Home icon, clicking Home persists exactly one default while current checkout destination is unchanged. Local tests 10/10 and full React parity/operational/build PASS. No Functions/Rules changes, real tenant/order/customer writes, main merge, reset/clean, or old hashed bundle removal. Physical-device GPS validation remains manual; see WORKLOG.



## Latest: Delivery address card and mobile modal visual repair — Build 2026.10.09.502

- User screenshots after .501 showed a square border around radio, oversized modal location icon/unbalanced close control on PC, and unusable mobile modal map heading at 440px.
- Root cause confirmed via Chrome computed geometry: mobile map heading had a 100%-width GPS button still arranged in a flex row, compressing the title to 0px at 440px. Old global icon sizing enlarged glyphs. These bugs evaded 320px-only checks.
- Fixed only react-app/public/parity/css/delivery-addresses.css: explicitly circular 20px radio with keyboard focus and refined card styling; center-aligned pin/close glyphs in proportionate buttons; map header now two columns on PC and one stacked column <=640px with readable description and independent full-width GPS action. Mobile modal fills screen and scrolls with fixed footer; saved-address logic, unique home primary and native Google marker unchanged.
- Build 2026.10.09.502 JS /react/assets/index-dsgwEW43.js. Focused UI regressions 8/8, Operational, full React Parity, build contract PASS. Actual installed Chrome widths 320/360/390/440/768/1280: radio 50% radius with no square, icon/close center difference 0px, mobile map title 278-384px wide with button beneath, desktop right-aligned button, no overflow/page errors, map usable.
- PRODUCTION CONFIRMED: feature commit a6a912b2 pushed to feature/react-firebase-port 0/0; Firebase Hosting foodapp deployed Build 2026.10.09.502, 565 public files. Live /admin, Delivery, Cashier, Kitchen pages reference index-dsgwEW43.js and JS/delivery-addresses.css bytes match Mac. Production Chrome guest/GPS read-only smoke at 320/440/1280 PASS: radio no box (round 50%), pin and close glyphs precisely centered (0px error), mobile map title readable (384px at 440, previously 0px), independent full-width GPS button actually works, no horizontal overflow or console page errors; PC right-aligned GPS action retained. No Functions/Rules changes or real data writes; physical-device Safari remains manual acceptance. No main merge/reset/clean or old bundle removal.

## Latest: Compact saved delivery address cards and wide editor — Build 2026.10.09.501

- User screenshot PC/Mobile requested header "ที่อยู่จัดส่งของฉัน" + Add Address on one row; address cards show only address labels (details during edit only); "ตั้งเป็นหลัก" replaced with clickable house icon top-right on each card with exactly one default; edit/create form and Google map enlarged significantly across PC/Mobile.
- DeliveryPage.jsx: compact radio-selectable cards, accessible top-right \`address-primary-button\` with \`bi-house\` / \`bi-house-fill\`, \`aria-pressed\`, separate edit/delete actions. Exclusive default normalized on saving/editing/deleting and by \`makeDefault\` persisting profile. Current selected delivery destination does NOT change when setting primary. No default editor checkbox.
- Address form uses a portal dialog to body with fixed header/footer and scrollable inputs + map, mobile nearly full viewport and PC up to 700px, Escape close and visible validation. \`delivery-addresses.css\` responsive 320–1280, single-row header and compact card.
- Existing saved-address-only checkout, 100m GPS selection, Google native marker, and server store-hours protection unchanged. Guest test profile only, no live tenant writes. New \`tests/react-parity/delivery-address-book-ui.spec.mjs\` 5/5 PASS, integrated full React parity; changed existing Playwright fixture to allow GPS within 100m and assert home icon. Full React parity / operational / Vite Build PASS. Installed Chrome actual compiled-app test at 320/360/390/440/768/1280 confirms single-row Add, compact cards, unique persisted primary icon, edit modal width 308–700px and map width 270–626px, no horizontal overflow, validation/ESC PASS; guest profile edit/save + create/save pinned address PASS.
- PRODUCTION CONFIRMED: implementation commit \`ffbf5138\` pushed to feature/react-firebase-port (0/0); Hosting:foodapp project chat-45754 deployed Build 2026.10.09.501. Live /admin, Delivery, Cashier & Kitchen HTTP 200 and JS index-CbV5hfUt.js / delivery-addresses.css exactly match Mac. Chrome Production isolated guest profiles PASS at 390 and 1280px: one-line header/Add, 99px cards with no details, exactly one clickable persisted home primary, modal and Google map large with no overflow/errors. Local Chrome 320–1280 and guest save/edit/create also PASS. No Functions/Rules changes, real tenant writes, main merge/reset/clean or old bundle deletion. See WORKLOG.

## Latest: Delivery saved-only GPS address matching and Google pin cleanup — Build .500

- User clarified: even when there is exactly ONE saved default address, if fresh accurate device GPS is farther than 100m from it, do NOT select it automatically. If multiple saved addresses, auto-select the nearest only if inside 100m. If GPS unavailable/coarse, or no addresses nearby, leave checkout selection empty and show customer a clear choice: manually select saved address or add/save a new address with its own GPS pin. With zero saved addresses, Delivery cannot proceed.
- In DeliveryPage.jsx, raw GPS and manual checkout map click/text can never create a new unsaved delivery destination. Saved address ID, exact saved pin coordinates and address text must match before submission; still permits explicitly choosing a saved address outside current GPS range. The old pin-confirm checkbox, state, and requirement were removed. Checkout Google map is view-only for saved pin; separate saved-address editor retains GPS/map editing. Selected address deletion clears checkout pin. Guard persists for store-hours and payment.
- DeliveryLocationPicker.jsx uses ONLY native Google Maps Marker, removing the duplicate green independent marker, and removes the checkout-level GPS button (saved address editor retains it). Orphaned mapPinProjection.js intentionally removed, previous hashed Vite bundles not removed.
- Improved closed shop banner and added amber choose-or-save notice; 5 supported languages updated. No backend, Functions or Rules changed. As guest address book is browser-local, this Saved Address membership check is a frontend rule, whereas existing Backend store-hours blocking remains separate.
- Build 2026.10.09.500, bundled JS /react/assets/index-a0X6jxym.js. Location integrity 12/12, Opening Hours 10/10, Server Security 7/7, Operational, React Parity and generated build PASS. Chrome local compiled-app scenarios PASS on PC/mobile: one far default, one near, closest of several, no addresses, GPS denied and explicit manual selection. No live customer data/order writes.
- PRODUCTION CONFIRMED: implementation commit b318bae9 pushed to feature/react-firebase-port 0/0; Firebase Hosting foodapp released Build 2026.10.09.500. Live /admin, Delivery, Cashier and Kitchen reference index-a0X6jxym.js; JS and Delivery CSS exactly match Mac. Live Chrome with isolated guest profile/emulated GPS PASS on PC and Mobile: one far saved remains unselected and warns, multiple saved near picks closest, zero saved blocked, GPS denied unselected, no green overlay or old checkbox. Real physical GPS, authenticated customer data and actual order remain manual acceptance. No Functions/Rules changes, tenant writes, main merge or historical bundle deletion.

## Latest: Admin Delivery opening-hours UI toggle + full day labels — Build .499

- User screenshot /admin requested a right-side toggle switch for manual Open/Close alongside Restore Normal Schedule button in same header row; change weekday labels to full Thai and English names and all supported locales.
- DeliveryHoursEditor component now uses accessible controlled role=switch, persisted effective opening state for checked, the existing immediate admin save callback for mode open/closed (with reason/end time), and Restore Schedule button in the same right-aligned header row. Mobile short schedule label fits down to 320px.
- CSS and TH/EN/MY/LO/KM translations updated. Underlying day numbers and Firestore schema unchanged. Build 2026.10.09.499, new asset /react/assets/index-Cfuu91Og.js. No backend or Rules changes.
- Targeted tests 10/10 and server guard 7/7 PASS; Operational, full React parity and build PASS. Chrome rendered actual component TH/EN 320-1366px and MY/LO/KM 440px with no overflow, tested Closed->Open->Normal Schedule callbacks successfully.
- PRODUCTION CONFIRMED: implementation commit 604e61c8 pushed to feature/react-firebase-port, 0/0 ahead/behind; Firebase Hosting foodapp deployed Build 2026.10.09.499. Live /admin, Delivery, Cashier, Kitchen HTTP 200 and /react/assets/index-Cfuu91Og.js, admin-opening-hours.css and Firebase shared asset byte-identical to Mac. No production tenant toggle, auth-session or payment tests; UI component tested locally with actual React interaction. No Functions/Rules changes, no tenant writes, no main merge/reset/clean/deletion of old bundles.

## Latest: Delivery server-side closed-store enforcement — Build 2026.10.09.498

- User explicitly authorized **Cloud Functions and Firestore Security Rules** to prevent external/custom SDK order submissions while store is closed, after .497 client-only schedule protection.
- Problem: public Firestore direct \`orderType="delivery"\` create was allowed in both root \`/orders\` and tenant \`/tenants/{id}/orders\`; frontend safeguards were bypassable.
- New isolated \`functions/public-delivery-submit.js\` callable \`submitPublicDeliveryOrder\` (asia-southeast1, Node22) validates public guest Delivery payload and computes hours with \`functions/delivery-opening-hours.js\` matching React Bangkok timezone policy. Admin SDK Firestore transaction atomically reads store schedule, manual override and order ID; blocks closed/missing/retail-only/duplicates, creates new pending Delivery with server-owned status/ID/timestamps.
- React now submits \`createPublicDeliveryOrder\` via callable after existing gift/Slip2Go steps, preserving API shape. \`firestore.rules\` blocks all client direct Delivery order creates on root/tenant paths and orderType-morph updates; Takeaway, Table, other channels retain create permissions. Existing orders are unchanged.
- New \`delivery-server-guard.spec.mjs\` 7/7 PASS and updated \`delivery-opening-hours.spec.mjs\` 10/10 PASS; Operational, Full React Parity, Vite build/postbuild & Function Node syntax PASS. Build **2026.10.09.498** asset \`/react/assets/index-CNsdruuu.js\`.
- Rollout must be ordered: deploy **only** \`functions:submitPublicDeliveryOrder\` -> verify -> **hosting:foodapp** -> verify new JS -> **firestore:rules** -> verify. Do not deploy other Functions/Rules, no data mutation, no main merge/reset/clean. Java is unavailable on Mac so Firestore Emulator not executed; rely on static contract tests and Firebase compilation. User should refresh cached prior Delivery builds to avoid client direct-write denial after Rules change.
- PRODUCTION CONFIRMED: implementation commit \`728a6eb7\` and Rules cleanup \`44d373fb\` pushed. Callable \`functions:submitPublicDeliveryOrder\` Node22 Gen2 deployed in asia-southeast1, invalid-input live probe HTTP 400; a valid-shaped fake COD request for nonexistent tenant was rejected by real Firestore transaction (HTTP 404 DELIVERY_STORE_STATUS_UNAVAILABLE) without creating an order. Hosting \`foodapp\` deployed Build .498, live /admin, Delivery, Cashier & Kitchen routes HTTP 200 and bundle byte-identical. Firestore Rules compiled and deployed **twice**, final clean version without compiler warnings and blocking public client Delivery creates on root and tenant paths, old Table/Takeaway create rules unchanged. Chrome post-Rules Delivery PC 1280/Mobile 390 read-only smoke PASS. Java unavailable so emulator not run, and real authenticated checkout remains manual acceptance. New functionality is closure enforcement, not general spam/App Check/payment fraud prevention; anonymous guests may order via guarded callable while store is open. See latest WORKLOG.

## Latest: Weekly Delivery opening hours + emergency open/close — Build 2026.10.09.497

- Requested restaurant shop weekly schedule (each Monday–Sunday with enabled checkbox + per-day opening/closing HH:MM), with a separate immediate override for emergencies/renovation (open now, close now, normal schedule; optional reason and Bangkok-local end time). Checkout outside allowed periods shows a prominent "store closed" status and blocks new Delivery orders. Table, Takeaway, Retail POS unaffected.
- \`DeliveryHoursEditor.jsx\` lives inside Admin Settings; weekly \`deliveryHours\` saved with existing Store Settings button; \`deliveryManualStatus\` saved immediately and separately via \`saveAdminStoreSettings\`. Current status uses saved schedule (not unsaved edits). Settings live at \`tenants/{tenantId}/settings/store\`; **no DB backfill**; older shops remain open 24/7 until weekly schedule explicitly enabled, so current merchants do not unexpectedly close at deployment.
- \`deliveryOpeningHours.js\` evaluates weekdays + 24h/overnight hours in Asia/Bangkok, temporary closure/reopen expiry; customer \`DeliveryPage.jsx\` live \`onSnapshot\` and 15s tick display closed banner/owner reason, disable cart actions and Submit; first settings snapshot must load before page ready.
- \`publicStorefrontData.js\`: uncached store status read before payment step; Firestore \`runTransaction\` checks the latest store settings alongside the Delivery order write, rejects if closed. **Security caveat:** separate Firestore Rules or server-side order submission is still needed against arbitrary malicious SDK writes; Functions/Rules have not been deployed or changed (Hosting-only policy). Existing orders, payout/Slip2Go logic unaffected.
- Version 0.4.280 Build **2026.10.09.497**, main asset \`/react/assets/index-xdqGCsHK.js\`. Targeted opening-hours regressions 10/10 PASS, Operational PASS, full React Parity PASS, build/contract PASS, responsive static Chrome layout 320–1366px PASS. TH/EN/MY/LO/KM messages. Worklog has scope and verification.
- PRODUCTION CONFIRMED: commit dcdb1325 pushed to feature/react-firebase-port (0/0); Hosting:foodapp deployed to penguin-food.web.app. Live /admin, /delivery, /cashier, /kitchen reference index-xdqGCsHK.js and new Firebase runtime firebase-IqF1EeP8.js; CSS and JS match Mac bytes. Read-only Chrome Production Delivery PC 1280/Mobile 390 loaded; old unconfigured test shop remained open. No real tenant Admin override save or customer order/payment tests. If user wants rule-level protection against direct Firestore SDK writes outside schedule, obtain explicit Rules/Function rollout approval first. Never merge main, reset/clean or delete historic Vite bundles.

## Latest: Show independent delivery pin only after map projection — Build 2026.10.09.496

- After .495, live Google Maps production smoke showed an overlay pin could flash at top-left before Maps initialization, because JSX made pin visible as soon as valid coords arrived.
- .496 fixes this: the independent geo-anchored pin remains hidden until \`mapState==="ready"\` **and** \`syncVisiblePin\` has calculated a valid projected pixel position; default CSS visibility is hidden. Cleanup/invalid pin also hide. Preserves closest saved address selection (<=100m after profile loading), standalone saved editor, customer confirmation, and self-delivery route sharing.
- Release Build **2026.10.09.496**, generated asset \`/react/assets/index-C7iJdWGI.js\`. Targeted location regressions **12/12 PASS**, React parity and build contract PASS. Google Maps real production acceptance still pending until Hosting release checked; no real customer writes.
- PRODUCTION VERIFIED: commit 5de1b27f pushed to feature/react-firebase-port; Firebase Hosting foodapp deployed to penguin-food.web.app. Chrome on real Production and actual Google Maps JavaScript, using isolated guest address fixture and emulated GPS, PASS on PC 1280 and Mobile 440: selected nearest saved B, map content loaded and projected marker visible. Still require real device/customer verification. No Cloud Functions/Rules, tenant writes, main merge, reset, or historic bundle removal.

## Follow-up: Google Maps lite/static renderer visible pin — Build 2026.10.09.495

- Post-.494 Production browser check found Google Maps could render using StaticMapService/lite HTML instead of classic \`.gm-style\`, with correct Saved Address values but no reliable native Marker visual. Prior \`.gm-style\` wait timeout was a too-specific map-renderer check, not proof that Google Maps API was absent.
- \`react-app/src/utils/mapPinProjection.js\` projects the saved coordinate to viewport pixels using Mercator zoom/centre with world wrap, and \`DeliveryLocationPicker.jsx\` draws an independent, pointer-transparent visible pin anchored to the true customer coordinate. It updates on Google map centre/zoom/idle, stays positioned when map pans, and hides invalid/offscreen pins. Native Marker remains for drag interaction. \`delivery-location-map.css\` adds high-contrast marker styling.
- Build **2026.10.09.495**, bundle \`/react/assets/index-BGHWZobX.js\`. Regression 12/12, React parity and operational contracts, Vite build/contract PASS. Chrome compiled-app PC width 1280 & mobile 440 using controlled Maps renderer: visible overlay pin at selected saved B; pan east moves projected pin left. No real customer's GPS was used. Earlier .494 fix (profile-before-GPS and map load race) remains.
- Implementation commit/push and Hosting production verification pending at this checkpoint. Deploy Hosting:foodapp only, no Functions/Rules/tenant writes, no merge main, no deletion of old bundles. Real iOS/Android Google Maps acceptance still required.

## Latest Google Maps marker and address-first loading checkpoint — Build 2026.10.09.494

- User found that after .493 the selected Saved Address and numeric coordinates did not always produce a visible Google Maps marker. Root cause: async Google Maps init captures null \`normalized\`, creates a hidden pin, and missed new \`value\` updates that arrived before \`mapRef.current\` existed; map click listeners also captured old React callback.
- Fix \`DeliveryLocationPicker.jsx\`: read latest coordinates via \`locationRef\` at API completion; synchronize marker creation/visibility/position and map centre/zoom when Maps becomes ready, even if address loads before map. Remove marker for invalid/cleared pin; use \`applyRef\` to keep click/drag up to date. PC and Mobile both.
- Fix \`DeliveryPage.jsx\`: start initial geolocation only **after** the saved address book loads, then select nearest valid saved pin within 100m (Laravel policy). When no saved pin near GPS, keep GPS and prompt to enter/verify delivery address + pin with store; when GPS unavailable, explain default saved fallback. Existing explicit pin confirmation remains. Messages localized TH/EN/MY/LO/KM.
- Build **2026.10.09.494**, main asset \`/react/assets/index-D8_RhRxF.js\`. Location integrity regressions **11/11 PASS**, React parity PASS, build contract PASS, Git diff --check PASS. Chrome on Mac with controlled Google Map/Marker mock: Desktop 1280px & Mobile 440px rendered correct marker at auto-nearest Saved B with zoom 16, changing to Saved A moved pin, clicking map updated pin and deselected A. These are real DOM interactions on compiled app but not live device GPS or production Google Maps tiles.
- Implementation commit/push and Hosting release pending when checkpoint was drafted. Update after production verification. Only Firebase Hosting; no Functions/Rules, customer profile/order writes, main merge, reset/clean or deletion of existing hashed assets.

## Latest Laravel GPS-nearest and driver-route checkpoint — Build 2026.10.09.493

- User specifically wants **Laravel MASTER location flow**: auto request device GPS when customer opens Delivery on PC/mobile, select the nearest saved address to that GPS (up to 100 metres) even when it is *not* the default saved address. Explicit clicks/drags must never auto-snap. If no saved pin is nearby, use raw GPS; if GPS unavailable, fallback to default saved address.
- Read-only Laravel files used for reference: \`public/assets/js/delivery-location-map.js\`, \`delivery-location-address-resolver.js\` and \`delivery-addresses-normal-button.js\` from \`/Users/natchanonsripleng/Desktop/Sites/food-order-app-php80\` (main).
- React now requests fresh GPS on page mount and waits for guest/customer profile before initial selection; \`deliveryLocationPolicy.js\` provides 100m closest saved-match only for \`current-location\` sources. User manual choices win if GPS callback arrives later. Strict GPS accuracy, no silent saved pin rewriting, separate Saved Address map, payment lock and explicit checkout pin confirmation remain protected.
- User also wants self-delivery driver Maps link from **store -> customer**, not current-driver-position -> customer. \`deliveryDriverMapsUrl(order, storeLocation)\` now requires validated origin from existing read-only \`getOperationalStoreSettings(tenantId)\` (\`tenants/{id}/settings/store\`: \`storeLatitude/storeLongitude\`) and validated order \`deliveryLatitude/Longitude\`. Missing store/customer pins block share with a localized error. Other delivery providers excluded.
- Build **2026.10.09.493**, Production asset \`/react/assets/index-CkmdkY6R.js\`; location regressions 9/9 PASS, driver route 6/6 PASS, operational & React parity suite PASS, build verification PASS. Chrome local and **Production** browser PC and Mobile: closer saved B wins against default A automatically; manual override intact; GPS denied falls back to A. See latest WORKLOG.
- **PRODUCTION CONFIRMED:** implementation commit \`bbd881f9\` pushed to \`origin/feature/react-firebase-port\`, Firebase Hosting \`hosting:foodapp\` deployed to \`penguin-food.web.app\`. Live Delivery/Cashier/Kitchen routes HTTP 200 reference \`index-CkmdkY6R.js\`, SHA256 byte-identical to Mac; prior .492 JS still accessible. Real iOS/Android GPS and authenticated Cashier Google Maps sharing still require manual acceptance. No Functions/Rules, customer data writes, main merge, reset/clean, or historical bundle deletion.
- **Supersedes Build .492 behavior** that deliberately did NOT choose a nearby saved address. The user's new requirement explicitly restores that Laravel behavior; do not regress to no-match mode.

## Latest Delivery GPS/saved-address checkpoint — Build 2026.10.09.492

- User reported GPS/current location and previously saved address pins mismatching, after the earlier driver-share release.
- Fix: **removed automatic 100m nearest-saved-address snapping**. Fresh GPS never gets replaced by a nearby saved pin. Initial default saved address still prefills, and explicit Saved Address selection pins exact saved coords. Google map viewport pans to selected saved pin.
- Saved Address editor has an **independent pinned map**; new address starts unpinned, editing existing address shows only that address's own stored coordinate, and only explicit Save Address persists it. Checkout no longer silently rewrites saved coordinates after successful order.
- GPS must be fresh, accuracy estimate <=100m; coarse/unavailable fix warns and leaves old pin unchanged. Checkout requires explicit customer pin confirmation before locking payment or submitting; checkout lock prevents pin/text selection changes. TH/EN/MY/LO/KM localized.
- Regression tests 8/8 PASS, operational PASS, React parity PASS, build contract PASS; Chrome local-browser guest scenario with saved A/B very close + GPS different: PASS; coarse 350m GPS rejects and warns: PASS. Final bundle **\`/react/assets/index-CsqMnk5f.js\`** Build **2026.10.09.492**.
- **PRODUCTION CONFIRMED:** implementation commit \`f6769081\` pushed to \`origin/feature/react-firebase-port\`; Firebase Hosting \`foodapp\` deployed successfully. Live Delivery, Cashier and Kitchen canonical routes HTTP 200 and use \`/react/assets/index-CsqMnk5f.js\` with SHA-256 byte-identical to Mac; Live Delivery CSS matches. No Functions/Rules/customer data mutation, no main merge, no reset/clean of historical bundles.
- After release, read-only Chrome smoke at real Production with isolated guest profile and mocked geolocation PASS (Saved A, different GPS <100m away, Saved B editing independent). Previously saved pins that are already incorrect **cannot be recovered automatically**: customer must explicitly edit, reposition on map and save. Physical GPS/Google Maps on real iOS/Android remains an acceptance test, not proven by Chrome mocked geolocation. Details in latest \`docs/WORKLOG.md\`.

## Latest self-delivery driver-share checkpoint — Build 2026.10.08.491

- User requested a **share-to-driver Google Maps button for store-managed Delivery only**, not Lalamove. Implementation is on \`feature/react-firebase-port\`; authoritative history in the last section of \`docs/WORKLOG.md\`.
- Cashier's Delivery order card now offers both \`ตรวจสอบบน Google Maps\` and \`แชร์พิกัดให้คนขับ\`, using the already persisted order deliveryLatitude/deliveryLongitude. Native share when available, otherwise clipboard, otherwise manual copy. Order number/address and Maps URL only; no phone. Invalid coordinates disable sharing. Lalamove/third-party excluded, including orders with Lalamove dispatch evidence. Legacy self-order with missing provider but no Lalamove metadata supported.
- React Build .491 **Production released**; generated bundle \`/react/assets/index-cdWz40EM.js\`. Targeted regressions 6/6 PASS, Operational PASS, React Parity PASS, build contract PASS, isolated Chrome responsive panel at 320/390/440/1024px PASS.
- Production CONFIRMED: commit \`35833f0c\` pushed to \`origin/feature/react-firebase-port\` and \`hosting:foodapp\` deployed successfully. Production /cashier, /cashier/quick-order, /s/saas-test-shop/delivery and /kitchen return HTTP 200 referencing \`/react/assets/index-cdWz40EM.js\` (SHA-256 matches Mac build); Cashier responsive CSS live and byte-identical. No Functions/Rules, tenant data, bundle deletion, or main merge.
- Important outstanding issue **not fixed by this feature**: auto-detected GPS vs saved address coordinate mismatches in DeliveryPage. Sharing uses the saved order pin, so customer/staff must confirm the pin before giving to driver. User follow-up for real mobile share/LINE and Google Maps app is still required.

## Latest checkout/receipt checkpoint (2026-10-08, supersedes earlier .487-.489 notes)

- Prior Build 2026.10.08.489 IS on Production (observed live asset `index-BCW1U1rO.js` matching local SHA-256), despite the historical .489 handoff claiming it was not deployed. Do not deploy .489 again.
- React Build 2026.10.08.490 Production release fixes Delivery PromptPay QR PNG downloads (including native-touch-safe link), successful Delivery checkout browser Back/history, and Quick Order receipt tab afterprint/paid-Walk-in cashier notification replay. See the latest section of `docs/WORKLOG.md` for causes, implementation and regression details.
- Operational PASS; React Parity PASS; targeted regressions 5/5 PASS; Build contract PASS. Built hashed asset: `/react/assets/index-BC-WUDBh.js`. Chrome Desktop and mobile-touch simulation downloaded valid actual PNG files.
- **PRODUCTION CONFIRMED:** implementation commit `fad923ad` pushed to `origin/feature/react-firebase-port`, Firebase Hosting `foodapp` deployed successfully. Live Delivery, Quick Order, Receipt, Cashier and Kitchen canonical pages HTTP 200 and all load `/react/assets/index-BC-WUDBh.js`, matching local Build 2026.10.08.490 SHA-256; previous .489 bundle is still accessible.
- Only Firebase Hosting release is permitted for this frontend fix. Never deploy Cloud Functions / Rules without explicit permission, merge main, or delete old hashed assets. Real customer Delivery and staff receipt workflow E2E still require user verification.

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

Maintain the completed and Production-deployed full-React frontend while preserving business behavior and tenant/data safety. Laravel MASTER remains authoritative for non-POS migration areas unless a newer user instruction overrides it. For POS route-specific UI from `/pos/sales` onward, the user now explicitly prefers intentional modern visual redesign over legacy visual parity.

Active focus as of 2026-10-08: **Restaurant/Cafe Delivery Slip2Go candidate is complete on React Build 2026.10.08.483, source commit ed16dcc8 (feat: verify restaurant Delivery slips via central Slip2Go with cashier fallback). Customer PromptPay slips are checked with PENGUIN central Slip2Go credentials/credits but receiver validation uses each tenant store's own PromptPay proxy. Auto-match requires authoritative server menu subtotal + delivery fee + total, exact slip receiver/amount, unique bank transaction reference, and a fresh server proof bound to order/cart/slip. Duplicate/amount mismatch/receiver mismatch/invalid results stop checkout so the customer can re-upload or switch to COD. Slip2Go/config/quota/rate-limit or unconfirmable delivery-fee paths fall back to server-recorded Cashier manual review. Cashier sees every Delivery order and manual approval runs through a trusted callable with actor audit; auto-matched orders need no receive-payment action. COD enters Kitchen immediately; PromptPay enters only after server auto-match or Cashier approval; Kitchen admission notifications fire on that transition. Firestore Rules protect manual-review payment fields from client staff writes. Candidate validation: Functions syntax PASS, Operational PASS, React parity PASS, Slip2Go+Kitchen 12/12 PASS, Firestore Rules dry-run compile PASS, targeted 4-Function dry-run PASS, React build contract PASS on /react/assets/index-BFsKHcE-.js, Hosting-emulator P0 52/52 PASS, Delivery parity 6/6 PASS. Delivery Success browser suite had 5/5 skipped because no success-order fixture was supplied, with no failures. **Production remains Build 2026.10.08.482. Nothing from .483 is deployed. Coordinated release requires Hosting + verifyDeliveryPaymentSlip, finalizeDeliveryPaymentSlip, approveDeliveryPaymentReview, notifyKitchenDeliveryAdmitted + Firestore Rules; do not deploy backend/Rules without explicit user authorization.** No merge to main.**

Previous active focus earlier on 2026-10-05: **React canonical `/pos` mobile/tablet sale workflow is now Production-deployed on React Build 2026.10.05.424 / Public Build 2026.10.05.139 via `0dbedc6c fix: restore POS mobile sale cart`. The React Tailwind responsive layer intentionally hides the desktop cart panel below 1024px, but React had not recreated Laravel's `retail-mobile-cart-bar.js` replacement UI, so products could be added while there was no visible bill/cart/payment path on mobile. React now renders the Laravel-style bottom sale-cart bar and slide-up/centered drawer through 1023px, including cart rows, net total, checkout, Hold Bill, and Held Bills. Production verification passed with deployed `/react/assets/index-BIOAaUA1.js`: at 440x956 the bar appears after adding a product, opens the drawer, and opens the existing payment dialog; at 768px the centered tablet bar works; at 1024px the mobile bar is hidden and the desktop cart panel is visible. Horizontal overflow, page errors, request failures, and HTTP errors were zero. Four expected customer-display Firestore write attempts occurred while adding products during verification and were intercepted/blocked, so Production data was not modified. POS migration remains complete through `/pos/settings`; remaining routes are `/pos/backup` and `/pos/users`, with `/pos/backup` next.**

Retail POS migration / design rule (updated by user 2026-10-04): **preserve all business logic, permissions, tenant scope, Firestore behavior, actions, export/print workflows, and important stable DOM/action contracts while replacing legacy implementation with React. The shared POS navigation drawer remains the approved tenant-selectable theme system (Modern Card v2.3 default). NEW visual exception explicitly approved at 20:39 on 2026-10-04: starting with `/pos/sales` (Sales History) and subsequent POS management/report screens, route-specific UI no longer has to visually match the old legacy 1:1 layout. These screens should be actively redesigned to be modern, colorful, graphic-rich, easier to scan, and responsive, while preserving the underlying behavior/data boundaries. Do not revert redesigned screens merely to satisfy old visual-parity expectations; update regression contracts to guard functionality plus the approved new visual structure.**

Retail POS current checkpoint: **canonical POS routes remain React and Production remains on Build 2026.10.08.482. The .483 candidate is Restaurant/Cafe Delivery Slip2Go only; no Retail POS business logic, collections, payment flow, or sale behavior is changed. Existing Backup/Users safety, five-theme navigation, Master business access and POS initial-readiness behavior remain unchanged.**

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
- Current candidate release identity: React 0.4.280 / 2026.10.08.483; public storefront historical identity remains 0.16.32 / 2026.10.07.172. Candidate bundle is /react/assets/index-BFsKHcE-.js. Production remains Build 2026.10.08.482 until an explicitly authorized coordinated Hosting + Functions + Firestore Rules release. Candidate source is ed16dcc8; Slip2Go/Kitchen regression 12/12, P0 candidate 52/52, Delivery parity 6/6, Rules/Functions dry-runs PASS.
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


## 2026-10-08 — Master business editor + signup card
- Master business selector in Super Admin tenant Edit; signup snapshot and revenue-share settings remain separate.
- Candidate Build 2026.10.08.474; see WORKLOG for release details.


### Production checkpoint — Build 2026.10.08.474
- Tenant Master business editor + signup card refresh committed 647e7bf2 and deployed to Hosting and updateTenant Function.
- Production HTML and CSS verified via HTTP. Authenticated editing interaction is not yet independently browser-verified.
- Untracked old candidate bundle: public/react/assets/index-Dplusb-p.js; do not randomly delete.

\n## 2026-10-08 — Revenue-share scope correction
Build candidate 2026.10.08.475: business type is Master-derived read-only in Revenue Share dialog; dual-business delivery-only excludes Retail POS, storefront/all includes POS. See WORKLOG.


### Production verification — Build 2026.10.08.475
- Revenue share Master-derived read-only business field + dual-business channel scope fix deployed to Hosting and five revenue-share Functions.
- Production HTML verifies index-4BuXq3cq.js; commit 959d5a43. Authenticated live tenant edits not performed.


## 2026-10-08 — In-progress Master business module access
Candidate Build .476 on local Mac only; React homepage and route guard updates pass tests. Firestore Rules and public/callable access audit outstanding. Not deployed. Respect no-Rules deployment rule without explicit approval; do not declare completion. See WORKLOG.


### Build .476 — Tenant Master access
- Home/private routes and tenant Firestore business collections enforce Master separation. User approved Rules deployment. No main merge. Retain generated old bundles.


### Production confirmed — Build 2026.10.08.476
- Master business Home/route filtering and Firestore tenant business collection access deployed successfully with user authorization.
- Production bundle index-BOJWGx2k.js; implementation commit 3ac480f5. Check WORKLOG. No main merge.
- Authenticated tenant smoke not performed; shared settings and callable access are outside this deployment scope.


## 2026-10-08 — Signup information visual compact layout
- Build 2026.10.08.477: expanded Super Admin tenant signup summary to full-width, Master left/detail grid right with responsive stacking. No backend logic changes. See WORKLOG.


### Production confirmed — Build 2026.10.08.477
- Compact full-width Super Admin signup information layout deployed on Hosting; implementation 9b4c0432. See WORKLOG.


## 2026-10-08 — Signup summary grid-span fix .478
- User reported .477 left-column layout. .478 forces registration summary to span all parent tenant-card grid columns; see WORKLOG.


## 2026-10-08 — Build .479 Home/POS loading fixes
- Home report readiness held until getTenantRevenueShareAccess resolves for owner/admin, POS Master guard uses styled full-screen overlay, Retail POS heading has green marker.
- Operational/React parity/Build PASS. See WORKLOG.


### Production confirmed — Build 2026.10.08.479
- Hosting complete, bundle index-BVRccUB-.js verified. Home loading, POS guard overlay and Retail POS heading marker fixes implemented; see WORKLOG.


## 2026-10-08 — Auto-save admin order .480
- Both category/menu order buttons renamed บันทึก; Sortable onEnd auto-persists on drop with queued latest change when saves overlap.
- Build .480. See WORKLOG for tests/deployment checkpoint.


### Production deployed — Admin sorting Auto-save Build .480
- Hosting updated with on-drop Auto-save for category/menu and renamed Save buttons. Implementation 1b562128. See WORKLOG.

## 2026-10-08 — Build .481
- Shortened Lalamove revoke button only, for mobile label fit; see WORKLOG.

### Build .481 deployed
- Short Lalamove revoke label in /admin/tenants deployed; implementation 290a4405.

## 2026-10-08 — Build .482
- Shortened Lalamove approval label; see WORKLOG.


## 2026-10-08 — WIP Delivery Slip2Go checkout / cashier / kitchen
- Started only: kitchen admission gate and tests in local working tree. NOT committed, pushed or deployed.
- Requires server-side verification + tenant-specific receiver + safe cashier manual approval + notifications before release.
- See latest WORKLOG. Do not deploy partial filter on its own.


## 2026-10-08 — Delivery Slip2Go central integration .483
- New restaurant Delivery verification callable and backend payment-finalization + kitchen alert triggers, merchant PromptPay receiver validation, manual cashier fallback and gated kitchen.
- Client messages localized. Modified Rules for kitchen payment field protection. Build .483 candidate.
- Before completing rollout inspect Firebase function deployment, callable runtime and authenticated checkout manual/E2E smoke; see WORKLOG.


### Shipping fee authenticity .483
- Server verifies delivery fees against persisted Lalamove quote, cached Google route or configured manual zone before Slip2Go auto-paid. Unverifiable -> cashier manually confirms, mismatched -> customer retries. Added quotePublicLalamoveDelivery to deployment scope. Firestore Rules dry-run clean.


### 2026-10-08 — Slip2Go Build .483 DEPLOYED
- User authorized and deployment succeeded: 5 Functions (verifyDeliveryPaymentSlip/finalizeDeliveryPaymentSlip/approveDeliveryPaymentReview/notifyKitchenDeliveryAdmitted/quotePublicLalamoveDelivery), Firestore Rules, and Hosting foodapp.
- Production /admin and /delivery reference index-BFsKHcE-.js, asset 200; no main merge.
- Next step: authenticated live E2E for matched/rejected slips, auto-paid/cashier manual and Kitchen notification; no real slip tested yet. See WORKLOG.


## 2026-10-08 — Delivery mobile sticky categories .484
- Mobile Delivery: only category tab strip is sticky; search scrolls with menu; active category follows current visible menu and tabs center automatically. Desktop/Table Order behavior unchanged. Hosting-only release; see WORKLOG.


### Build .484 delivered
- Delivery mobile category-only sticky/scroll-spy released to Firebase Hosting, implementation 3f4cb08a. Production verification recorded in WORKLOG.


## 2026-10-08 — Build .485 corrective mobile category pinning
- .484 sticky did not work according to user. .485 uses viewport fixed category strip + measured scroll anchor, search stays normal. Hosting only.


### Build .485 live
- Corrective viewport-fixed Delivery category scrolling released via Hosting, implementation 7df5d1f6. Live mobile visual confirmation still needed.


## 2026-10-08 — Delivery mobile both controls fixed Build .486
- Both category tabs and menu search now pinned together on mobile Delivery. Previous .485 pinned category alone. See WORKLOG.


## 2026-10-08 — Build .487 cashier legacy payment/audio candidate NOT DEPLOYED
- Legacy 07/10 slip receipt fails direct payment update since Firestore .483 protected fields. New candidate accepts pre-rollout legacy cashier approval via trusted callable, and kitchen notifier filters out unadmitted order IDs. Test/build then seek explicit Functions rollout permission. See WORKLOG.


### Build .487 deployed to Production
- Authorized and successfully deployed approveDeliveryPaymentReview Function and Hosting foodapp; /cashier serving index-B1NTOMkh.js.
- Follow up: real cashier legacy-slip settlement and browser sound bell/permission tests; see WORKLOG.

## 2026-10-08 — Quick Order display QR pairing repair, Build .488 (SOURCE ONLY, NOT DEPLOYED)
- User reports /pos/customer-display quick-order-* pairing QR / Open POS goes Retail POS.
- Confirmed previous URL-only commit d126ac8 was never built/deployed. Further issues: restaurant Master guard treated /pos/customer-display as Retail; QuickOrderPage ignored paired displayId after scanning/login.
- Code prepared on feature/react-firebase-port: new /cashier/customer-display route, QuickOrder links to it, pairing QR selects /cashier/quick-order for quick-order-* IDs, QuickOrder reads displayId/registerId from URL and writes to paired Firestore display, login preserves next path + query, restaurant-only legacy quick-order displays handled in MasterBusinessGuard.
- Regression script tests/react-parity/quick-order-display-pairing.spec.mjs added to React parity suite. Release prepared 2026.10.08.488.
- Desktop Commander quota exhausted; no local npm tests/build or Firebase Hosting deployment possible from this chat. Production remains .487 pending verified build and deploy, NO main merge.
- Next: on authorized Mac run git pull --ff-only origin feature/react-firebase-port, npm run test:operational, npm run test:react-parity, npm run build:react (generates .488), npx firebase-tools deploy --only hosting:foodapp --project chat-45754, then authenticated QR + button smoke tests including staff-device pairing and restaurant-only Master.

## 2026-10-08 — Build .489 Quick Order cashier back icon alignment (SOURCE ONLY)
- Scoped quick-header-back icon centered Y on desktop, X+Y on mobile using 40x40 square and 18px icon box. Added mobile accessible name and regression checks.
- Static GitHub source checks 8/8 PASS. Desktop Commander quota remains exhausted; no local tests/build or Hosting deployment performed. Production still .487.
- This release also contains previous unreleased .488 Quick Order display pairing changes. Mac must pull ff-only, test, build, deploy Hosting, then verify both icon and QR pairing. Never reset/clean or merge main. See WORKLOG.


## 2026-10-19 — Active priority PENGUIN Hybrid Billing Phase 3 source-only continuation

- Repo `Natchanon45/food-order-app`, branch `feature/react-firebase-port`. Confirm actual HEAD with Git (before this Phase 3 work `c9aef253`; no commit/push/merge in this round). Preserve 24 historical untracked `public/react/assets/index-*.js`, no reset/clean. The active task is Hybrid Billing, superseding older 2026-09-30 POS priority.
- Existing Phase1/2 Build .526, Preview only, `HYBRID_REGISTRATION_READY=false`; production still .524. Four **unexported and undeployed** Phase3 backend modules added: `hybrid-billing-ledger.js`, `hybrid-billing-payments.js`, `hybrid-billing-arrears.js`, `hybrid-billing-slip-quota.js`; their unit tests are included in `npm run test:hybrid-billing`. None is wired to live Functions/Delivery/UI, and not usable by tenant customers yet. Read `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_UAT.md` and `docs/WORKLOG.md` latest entries for exact safety and remaining steps.
- Resume: audit Firestore query transaction races (paidAt and refunds), implement credit-note/late-refund policy, independent payment evidence and Slip2Go verification server wrappers + Storage/Firestore Rules, invoice/payment/Super Admin UI, suspension & manual-hold-safe recovery, real Delivery quota hookup, emulator and PC/mobile staging UAT. Do not open Hybrid registration or deploy production before all gates and explicit authorization.
- First verify `git status --short --branch`, `git fetch origin`, `git diff --check`, `npm run test:hybrid-billing`, `npm run test:react-parity`, `npm run verify:react-build` and backend `node --check`. Update Worklog at every completed change; do not commit/push/merge without user instruction.

## 2026-10-19 — NEW OVERRIDING POLICY: Signup anniversary + full trigger day

- **User-confirmed; supersedes Phase 1 calendar-month and threshold-only notes:** Register 16/10/2026 → first cycle 16/10–15/11, reset 16/11 00:00 Bangkok, next reset 16/12. Trial flat waiver is this first anniversary cycle (not the initial calendar month). 29–31 anchor dates clamp in short months and return to original date in following longer months.
- On threshold-reaching date bill **entire day's** trusted paid Delivery merchandise AFTER that Bangkok date closes. Example: 09:00 threshold of 10,000 and by evening 15,500 paid today → **15,500 × 5% = 775 THB** one trigger invoice; next date charge only that day's sales; do not rebill previous dates.
- Source updated on Mac mini: `functions/hybrid-billing-core.js`, signup server anchor, `functions/hybrid-billing-preview.js`, paid Delivery cycle aggregation, internal ledger, internal Slip2Go quota, React date-based report, Thai/English/Myanmar/Lao/Khmer billing copy. Test suites updated including 23:30 never issues and 00:01 does, and quota 1 Nov not reset / 16 Nov reset. Read `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md` for status.
- Work remains source-only; no React build/deployment for these changes yet; `HYBRID_REGISTRATION_READY=false`, Phase3 functions unexported, production .524 unchanged. Leave local working modifications and all 24 untracked old hashed Build files intact, no reset/clean/checkout. No commit/push/merge without instruction. Resume emulator/bank/suspension/integration/UAT gates, not old calendar-month behavior.

## 2026-10-19 — Current Hybrid Phase 3E source-only transactional-read checkpoint

- New hardening after 16/10 -> 16/11 anniversary and trigger whole-day 775 THB update: `hybrid-billing-ledger.js` scans paid Delivery records *inside* Firestore invoice `tx.get(query)` using bounded full pagination (3000 max); `hybrid-billing-arrears.js` scans overdue invoices inside the same transaction that checks settlements/suspends, so late source changes before transaction read are not silently missed.
- `hybrid-billing-payments.js` now accepts only validated `YYYY-MM-DD:delivery:...` and `YYYY-MM-DD:monthly:fixed` invoice references, matching anniversary ledger; stale YYYY-MM references rejected. Additional `hybrid-billing-read-consistency.spec.mjs` tests plus ledger, arrears, bank settlement ID tests; Hybrid focused suite now **73/73 PASS**.
- CAUTION: no real Firestore Emulator concurrency test (not installed in prior Mac inspection), transaction contention/phantoms/refund mutations after issuance are not proven safe. Still need immutable receipts or credit adjustment policy, proper callable identity and Storage checks, safe unlock, real Slip2Go integration, security rules/UAT.
- Protect existing local working changes, 24 old hashed bundles and HEAD `c9aef253` until explicit Git instructions. Keep `HYBRID_REGISTRATION_READY=false`, all Phase3 modules unexported, no Production Firebase deploy/changes.

## 2026-10-19 — New Phase 3F Firestore Emulator checkpoint (after 3E)

- Firestore Emulator **DOES work** on authorized Mac mini using installed Android Studio JBR Java 25. System default Java 17 fails CLI, so runner only sets child JAVA_HOME/PATH, no global Java changes. `npm run test:hybrid-billing:emulator` starts a LOCAL, EPHEMERAL demo project `demo-penguin-hybrid-uat` with loopback :8187 and temp deny-all rules. **8/8 real Firestore integration PASS** (invoice 775 whole day, next day, historical refund fail-closed, arrears and settlement, transaction query 520 rows, concurrent invoice jobs only one immutable bill, previous cycle overdue, bank transfer ref reuse blocked, legacy tenant exclusion).
- Code: `tools/run-hybrid-billing-emulator.mjs`, `tests/react-parity/hybrid-billing-firestore-emulator.spec.mjs`, package.json test script; README + implementation + UAT + worklog docs. Earlier 3E `73/73` focused mock suite remains unchanged. NO commit/push/merge/deploy, frontend build still old .526, production .524, `HYBRID_REGISTRATION_READY=false`, billing ledger/payments/arrears/quota still NOT in Functions exports or scheduler.
- CRITICAL unfinished: concurrency when paidAt order is inserted/modified during query transaction, phantom index/write contention, late-order/refund adjustment/credit-note, real Auth/Storage/Rules permission matrix, secure wrappers and actual independent bank receipt checks, guarded recovery, Slip2Go & PC/mobile UAT. Emulator smoke is NOT staging release approval. Keep local modifications and 24 previous build JS untouched.

## 2026-10-19 — Phase 3G concurrent payment race results and NEW critical blockers

- `npm run test:hybrid-billing:emulator` now **12/12 PASS + 2 explicit TODO release blockers**. New real Firestore race cases cover inserted paidAt record before query, newly backdated order after seal, refund writer overlapping invoice scan, and double invoice job plus concurrent new paid-order writer. Earlier 73/73 Hybrid Node tests remain; rerun after any code changes.
- Critical: trusted `functions/delivery-slip.js` paid Delivery sets Firestore server Timestamp, BUT React `CashierPage.jsx` around line 819 direct non-PromptPay Delivery path sets `paidAt` to an ISO string via client update; the current billing ledger `where paidAt >= Timestamp` skips ISO-string/missing paidAt entirely. **Must fix by server-trusted canonical paid receipt path AND source completeness validation**, not by simply parsing client strings. Additionally `firestore.rules:tenantBusinessEnabled` does not deny writes when `hybridBillingSuspended=true` or tenant `active=false`. No coordinated client Rules/Storage/server writer security gate exists; DO NOT enable Hybrid registration or deploy any Hybrid functions.
- Concurrent writes after a seal are detected only on a subsequent billing attempt, at which point reconciliation fails closed; old invoice not silently modified, but automatic credit note / money adjustment not designed. User's day-close 15500 -> 775 and 16th anniversary policies unchanged.
- Protect all uncommitted work and 24 hashed assets on `feature/react-firebase-port` HEAD `c9aef253`. No Commit/Push/Merge/Production deploy.

## Phase 3G — Auth + Firestore Rules isolated candidate (local-only, 2026-10-19)

- New separate repeatable smoke command: `npm run test:hybrid-billing:rules-emulator`. The runner uses the checked-in `firestore.rules` **read-only** as a source and constructs an extra Hybrid billing `hybridBillingSuspended`/`active` check in a temporary file (never writes it to production rules). Uses fresh demo project `demo-penguin-hybrid-rules-uat`, localhost Auth :9098 + Firestore :8188, Android Studio JDK 25. No deployed rule changes, no Production tenant changes.
- Tests via real Firebase client SDK authentication and real Firestore Rules emulator: **5/5 local candidate scenarios PASS** for normal Hybrid read/update, suspended Hybrid order deny, suspended POS deny, unchanged legacy cashier read/update and billing/tenant fields inaccessible to cashier. This is a **partial policy smoke**, NOT security signoff.
- **Critical unresolved problem:** The Emulator prints `PERMISSION_DENIED: Unable to evaluate the expression as the maximum of 1000 expressions ...` for certain denied write paths. Consequently those writes may have been denied due to evaluation exhaustion, not because the new early guard is correctly evaluating all branches. Fix Rules complexity and rerun explicit allow/deny with no evaluation errors before counting writer authorization as proven. Also protect top-level legacy order write paths, Functions Admin SDK writers and Storage separately.
- Files: `tools/run-hybrid-billing-rules-emulator.mjs`, `tests/react-parity/hybrid-billing-rules-emulator.spec.mjs`, package.json command. No changes to `firestore.rules`, `storage.rules`, `firebase.json` or `.firebaserc`.

**Phase 3G FINAL STRICT SECURITY CHECK (2026-10-19):** `npm run test:hybrid-billing:rules-emulator` runs 5/5 role assertions but **intentionally exits with code 2 (BLOCKED)** because Firestore logged `maximum of 1000 expressions` on denied writes. The temporary candidate therefore MUST NOT be considered proven secure; real `firestore.rules` remains unchanged. The new runner now detects these messages and fails the UAT gate instead of returning a misleading success. In contrast, `npm run test:hybrid-billing:emulator` (transaction emulator) **12/12 PASS, 2 TODO**, focused `test:hybrid-billing` **73/73 PASS**, full React Parity **PASS**, Operational **PASS**, existing React Build .526 contract **PASS**, no new build/Production deploy.

## 2026-10-19 — Phase 3H: Paid Delivery source completeness fail-closed guard

- **Root cause verified:** Cashier's non-PromptPay Delivery write may store `paidAt` as ISO text, while the billing engine's timestamp range cannot select the row. The previous `paidDeliverySale` validator only rejected invalid timestamps it could see; invisible paid orders could cause silent underbilling.
- **Source-only mitigation implemented:** `functions/hybrid-billing-preview.js` now exports `auditPaidDeliveryReceiptCoverage(tenantRef, {transaction,maxRecords})`, a separate paginated Firestore query on ALL `orderType=delivery` + `paymentStatus=paid` records with independent index/order-by document ID, requiring true Firestore Timestamp-derived `toDate()`. Both read-only preview and internal `functions/hybrid-billing-ledger.js` now fail closed on ISO/missing paidAt before billing a period. Ledger audit runs inside its **same Firestore transaction** and before any invoice/period writes; scans bounded to 3,000 paid Delivery receipts per tenant across historical cycles. Overlimit and partial-read data also block issuance. No string conversion or client time trust, no production deployment.
- **Real Firestore Emulator QA:** **14/14 passed + 2 TODOs**. New end-to-end case proves a trusted 10,000 THB paid Delivery order plus an invisible 5,500 THB ISO paidAt cannot generate an underbilled 500 THB invoice or seal a period; invalid ISO and missing paidAt each abort. Read-only preview also aborts. POS ISO paidAt unaffected; 520-order audit pagination and 500-limit cutoff tested. Previous midnight/775 THB, idempotency, bank/arrears, concurrency cases still pass. Focused `npm run test:hybrid-billing` **73/73 PASS**.
- **Release remains BLOCKED:** Guard detects but does **NOT** repair existing ISO-string receipts or create an authoritative payment timestamp, so hybrid shops with these records cannot issue invoices. Need server-trusted non-PromptPay payment capture (cashier role and business guards), controlled reconciliation/migration of legacy data, full source completeness using immutable receipt events, Firestore compound index for `{orderType,paymentStatus}` in staging (`docs/HYBRID_BILLING_INDEXES_CANDIDATE.json` reference ONLY), scalable index/transaction design, late refund credit notes, and suspended-business Rules/backend enforcement. A 3,000-row tenant lifetime cap is an intentional fail-closed staging guard, not a production-scalable solution.
- `npm run test:hybrid-billing:rules-emulator` is **still explicitly BLOCKED (exit 2)** due to Firestore Rules `maximum of 1000 expressions` on denied writes despite 5/5 client assertions. This has NOT been bypassed. No modifications to production Rules/Storage/indexes or Firestore project, no Functions exports/deploy, no commit/push/merge, `HYBRID_REGISTRATION_READY=false`.


## 2026-10-20 — Phase 3I latest COD checkpoint

- New source-only `functions/hybrid-billing-cod-payment.js`: transactional Hybrid COD cashier settlement with server Timestamp, trusted user/tenant/order reads and idempotency; **not exported/wired/deployed**, legacy Cashier still uses client ISO timestamp for COD. `tests/react-parity/hybrid-billing-cod-payment.spec.mjs` included in `npm run test:hybrid-billing`. Focused Node **77/77 PASS**; real Firestore Emulator **19/19 PASS + 2 TODO**, including 5 COD tests.
- Temporary rules runner now prepends Hybrid early write gate to order/POS candidates, but strict Rules Emulator **BLOCKED exit 2**: 5/5 individual assertions pass yet denied operations exceed 1,000 Rules expressions. Do not claim security approval or deploy partial rules. Keep `HYBRID_REGISTRATION_READY=false`, Phase3 modules unexported, HEAD c9aef253 with 24 untracked old Vite assets protected and no git commit/push/merge.
- Next: authenticated onCall wrapper (actor only from request.auth.uid), hybrid-only Cashier integration, reviewed rules disallowing browser COD payment forgery, comprehensive backend suspension/payment receipt provenance/immutable amount, index/scaling, late payment adjustments, staged UAT. Run full suites and record results.


## 2026-10-20 — Phase 3J latest checkpoint

- **New file** `functions/hybrid-billing-cod-callable.js`: v2 `onCall` candidate (not exported by `functions/index.js`) with `enforceAppCheck:true`, strict `tenantId/orderId` input only, `request.auth.uid` actor, safe HTTPS error translation, delegates to transactional 3I COD engine. React Cashier still uses existing non-PromptPay ISO-paidAt client path. NOT deployed/activated; `HYBRID_REGISTRATION_READY=false`.
- Internal COD engine now rejects Lalamove `COMPLETED` alone; requires COD enablement, provider ID and completion timestamps. Trusted Webhook/Refresh populate these fields but checked-in browser-facing Rules do not yet protect them; not proof of secure server attestation without reviewed Rules. Emulator status-only forgery test passes.
- Hybrid Unit/contract **81/81 PASS** (new four handler-level tests); real Firestore Emulator **21/21 PASS +2 TODO** (new two handler-to-Firestore transaction tests). Auth-shaped mock ≠ real Auth/AppCheck callable end-to-end. Temporary Rules candidate includes Hybrid price/payment/provider-field write integrity + legacy preserved; **7/7 assertions, but STRICT BLOCKED exit 2** on Rules 1000-expression limit. No checked-in Rules/index changed.
- No commit/push/merge/deploy/new build; protect 24 old hashed JS artifacts, other uncommitted files and branch `feature/react-firebase-port` HEAD `c9aef253`. Next focus: reduce Rules evaluator cost / test 100%-valid allow-deny; integrate staged Functions+Auth+AppCheck+Storage emulators; confirm provider verification and backend suspension writers; only then consider hybrid-specific React cashier cutover behind flag.

- **Phase 3J final checks confirmed:** 81/81 Hybrid Node PASS; 21/21 Firestore Emulator PASS +2 TODO; strict Rules Candidate BLOCKED exit2 even though 7/7 assertions; React Parity/Operational/OLD .526 Build verification PASS; static/diff check PASS. Branch `feature/react-firebase-port` HEAD `c9aef253` 0/0. Old hashed assets 24 retained; emulator created `firestore-debug.log` untracked (leave untouched). Production Firebase configs unchanged, registration off, callable not exported.


## 2026-10-20 — Phase 3K latest: complete simulated golden path, Cashier cutover OFF

- Source-only React Cashier now explicitly branches Hybrid Delivery from Legacy. New `react-app/src/data/hybridCodCashierRoute.mjs` has `HYBRID_COD_CASHIER_CUTOVER_READY=false`; `react-app/src/data/hybridCodCashier.js` is a staged adapter that never makes direct Firestore payment writes or references an unavailable `httpsCallable` endpoint. Cashier blocked Hybrid COD and unsupported methods **fail closed** instead of browser ISO `paidAt`; Hybrid PromptPay still existing manual proof review; Legacy unchanged. No Build/new Deployment.
- Real Firestore Emulator golden path **22/22 PASS, 2 TODO** includes staged COD receipts 10,000+5,500 THB → after Bangkok midnight exactly **775 THB** invoice → mock evidence → mock bank reviewer → paid/suspended-awaiting-manual-recovery. The Auth-shaped handler and paidAt timestamps are synthetic fixtures, not real Functions/Auth/AppCheck/Storage/bank integrations.
- Focused `npm run test:hybrid-billing` **87/87 PASS**; `npm run test:react-parity` PASS after respecting strict React callable contract (do NOT bind to unexported callable); Rules Emulator **7/7 assertions but BLOCKED exit 2** unchanged. No production `functions/index.js` export; both `HYBRID_REGISTRATION_READY=false` and `HYBRID_COD_CASHIER_CUTOVER_READY=false`.
- Next: fix Rules evaluator budget, add Firebase Functions/Auth/AppCheck/Storage emulator full E2E, secure COD source/proof/old data and recovery workflow, staging PC/mobile UAT. Never enable cutover or production deploy before these gates; preserve all dirty files and old hashed bundles. HEAD `c9aef253` branch `feature/react-firebase-port`.


## 2026-10-20 — MIGRATED TO GITHUB-FIRST (this section supersedes earlier Mac-first instructions)

- **Canonical active development branch:** \`Natchanon45/food-order-app\` → \`feature/hybrid-billing-github-first\`. Keep \`feature/react-firebase-port\` as the untouched original remote branch; do not merge or deploy automatically.
- One-time migration completed from Mac mini: full local Hybrid Billing source/tests/docs (**39 files**) safely staged and committed as \`0c8c9c4937dd8efe6a3972d676c22552e58aa322\` after \`npm run test:hybrid-billing\` **87/87 PASS** and \`npm run test:react-parity\` PASS. GitHub commit confirmed. No generated Build JS or emulator log was included.
- Direct GitHub contribution added \`.github/workflows/hybrid-billing-github-first.yml\` in \`9f4f65e7deef8765843f6c91c08e4096f3b36dc9\`. Push/PR on this specific branch runs Node contracts, React Parity, Operational, existing build verification and isolated demo Firestore Emulator on GitHub Actions (no credentials or deploy step). CI configuration created; **do not claim remote CI has passed unless its checks are actually verified**. Auth/Rules security candidate is deliberately not a green release gate: it still exits **BLOCKED 2** on 1000-expression limit.
- Mac mini working branch was renamed **without checkout or reset** to \`feature/hybrid-billing-github-first\`, upstream set to matching \`origin/feature/hybrid-billing-github-first\`; a one-time \`git pull --ff-only\` reached \`9f4f65e7\` with **0/0** remote tracking. Filesystem backup for the original uncommitted work was left on Mac at \`~/Desktop/PENGUIN_GITHUB_SYNC_BACKUP_20261020/\` (tracked binary diff patch + archive of 21 untracked source files + manifests). Original **24 untracked generated Vite hashed JS files** and \`firestore-debug.log\` deliberately remain on the Mac. Do NOT reset/clean/remove them.
- **From now on, develop/commit/push through GitHub tools, not Mac MCP.** Use Mac mini MCP only after an explicit need for \`git pull --ff-only\`, local emulator, \`npm run build:react\`, or approved Firebase deployment. Verify branch/tracking/untracked assets first. Later GitHub commits will intentionally leave Mac a few commits behind until the next pull.
- **Both operational release switches remain OFF:** \`functions/hybrid-billing-settings.js\` has \`HYBRID_REGISTRATION_READY=false\`; \`react-app/src/data/hybridCodCashierRoute.mjs\` has \`HYBRID_COD_CASHIER_CUTOVER_READY=false\`. COD Callable prototype NOT exported from \`functions/index.js\`; no Production code/rules/index/deployment modified. Hybrid is still UAT/source-only. Legacy tenants must remain unchanged.

## 2026-10-20 — Phase 3L GitHub-first SECURITY BLOCKED checkpoint (latest)

- Work **directly in GitHub** on `Natchanon45/food-order-app` branch `feature/hybrid-billing-github-first`, review Draft PR #7: https://github.com/Natchanon45/food-order-app/pull/7. Mac mini was NOT used this phase and intentionally stays at its earlier source snapshot until the next approved `git pull --ff-only`.
- GitHub Actions separate **Unit/React Parity/Operational/old-build** and **real Firestore demo emulator** jobs are PASS. Rules security job is RED, strictly and correctly: 7/7 policy assertions but emulator maximum 1,000 expressions on denied update/write -> exit 2. Do NOT treat as approved.
- Candidate-only diagnostic in `tools/run-hybrid-billing-rules-emulator.mjs`: try short-circuiting tenant business before Super Admin, inexpensive POS update precondition `resource != null`, and active-Hybrid COD fields immutable in temporary rules. The original deployed `firestore.rules` file was NOT changed.
- **Important new finding:** a separate `npm run test:hybrid-billing:rules-baseline` runs **original unchanged** production source Rules in isolated demo Auth+Firestore emulators. Its 4/4 assertions pass, but strict exit 2 because even the original legacy POS rules exceed 1,000 expressions on a malformed new-sale `setDoc` upsert, so the evaluator-budget bug **partly predates Hybrid**. Denied tenant/user mutations show other evaluation errors. Candidate still fails too.
- GitHub Actions `.github/workflows/hybrid-billing-github-first.yml` runs security test AND baseline as separate steps, even when the former fails; both remain visible as RED until fixed. Last full candidate and baseline logs are in Draft PR #7 Actions checks; see current `docs/WORKLOG.md` phase 3L.
- Next: refactor/test POS create/update and tenant order rules **in TEMPORARY candidate first**, collect Firestore Emulator ruleCoverage and verify clean-denial integrity before considering production rule edits; keep Legacy semantics. Continue AppCheck/Functions/Storage/real bank E2E and historical receipt remediation after security. Do not merge/deploy or flip either Hybrid release flag. Keep `functions/index.js` COD prototype unexported.


## 2026-10-20 — Latest GitHub-only Hybrid integration checkpoint (supersedes 3L blockers)

- Canonical repo/branch: `Natchanon45/food-order-app` / `feature/hybrid-billing-github-first`, review **Draft PR #7**. Mac mini not used, remains behind by design; do not checkout/reset/clean untracked historical Vite assets.
- BIG CHANGE: `firestore.rules` SOURCE reviewed, no deployment. Legacy/Hybrid policy now passes strict Auth + Firestore Emulator **7/7 + 4/4** with no 1000-expression evaluator limit in test matrix. Also reviewed `storage.rules` SOURCE, Auth + Storage security **4/4 PASS**, private hybrid proof create-only after fixing same-path overwrite; no deployment.
- Added source-only `functions/hybrid-billing-recovery.js` (Super Admin verified invoice settlement, human-only recovery, original-suspension check), `functions/hybrid-billing-daily.js` (Bangkok previous-day issuer and arrears candidate) and `functions/hybrid-billing-finance-api.js` (invoice list, server-verified Storage evidence, manual bank review, recovery, controlled close/arrears). All candidates remain unexported from `functions/index.js` and financial API readiness `false`.
- Verified GH Actions workflow run **39362630750** for code commit **9c5ecdb7**: ALL **4 jobs GREEN**. Unit/React/Operational/old build check PASS (Hybrid 87/87); real Firestore Emulator **26 PASS +2 TODO**; Firestore Rules **7/7 +4/4**; Storage **4/4**. Test bank attestation and Storage metadata passed to Firestore-only finance flow are synthetic; Storage Emulator separately validates actual Storage policies.
- **Do NOT describe as production-complete.** Owner + Super Admin payment UI / backend HTTPS export, AppCheck/Functions/Storage actual end-to-end, true independent bank reconciliation, Lalamove status provenance, historical ISO paidAt cleanup, credit-note/refund handling, 3000 paid receipt cap/index scale, PC/mobile staging UAT and production rollout remain undone.
- Release flags `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_API_READY=false`. Neither schedule nor COD/Finance callable registered in `functions/index.js`. No merge/commit to original feature branch, no build or Firebase deploy.


## 2026-10-20 — LATEST GitHub-first Owner/Super Admin finance panel checkpoint

- Canonical branch `Natchanon45/food-order-app:feature/hybrid-billing-github-first`; Draft PR #7 still NOT merged. Do NOT use Mac MCP for ordinary development. Preserve dirty Mac assets; no build/deploy requested.
- Added `react-app/src/data/hybridFinanceStaging.mjs` (**`HYBRID_FINANCE_UI_READY=false`**) and `react-app/src/components/HybridBillingFinancePanel.jsx` wired into EXISTING `HybridBillingReportPage.jsx` (Owner) and `AdminTenantsPage.jsx` (Super Admin filtered to Hybrid tenant). It has staged invoice/proof, manual bank review and recovery UI, but **currently only renders the disabled notice**, intentionally no live financial actions.
- Added trusted finance `queue` action for Super Admin only to source-only `functions/hybrid-billing-finance-api.js`, listing pending proof safely, filtered after review. Added 5 UI/adapter tests and real Firestore Emulator queue checks.
- **Latest independently verified code CI run `39378510771`, source SHA `6b4f18d6`: all 5 GH Actions jobs PASS**. Node Hybrid **92/92**, Firestore emulator **26 PASS 2 TODO**, Rules Hybrid **7/7** and legacy baseline **4/4**, Storage **4/4**, React parity/operational and isolated **new JSX source compile** PASS. No generated bundling committed or deployed.
- **Release BLOCKERS remain:** Firebase Finance/COD callable NOT exported in index, source UI ready=false, Functions+Auth+AppCheck real endpoint testing not performed, independent bank verification, historical paidAt ISO migration, secure Lalamove proof, credits/refunds and audit scale, PC/mobile staging. Do not flip `HYBRID_FINANCE_API_READY`, `HYBRID_FINANCE_UI_READY`, `HYBRID_REGISTRATION_READY` or `HYBRID_COD_CASHIER_CUTOVER_READY` or deploy until release gates pass.
- Next work should be GitHub-only real Auth/Functions/AppCheck Emulator integration in temporary demo project (not production export), expanded Storage-to-Callable proof flow, then settle migration/refunds and staging UAT. Work is not yet production-ready.


## 2026-10-20 — Latest GitHub-first milestone: real HTTPS Callable Emulator 4/4 PASS

- Repo `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, Draft PR #7; work **exclusively on GitHub**, Mac mini unpulled intentionally. No Build/Deploy/merge or production function export.
- New `tools/run-hybrid-billing-functions-emulator.mjs` creates an ephemeral Firebase **demo Auth + Functions + Firestore** project. Only the temporary test wrapper exports `hybridCodDemo`/`hybridFinanceDemo`, invoking the real internal handlers. `tests/react-parity/hybrid-billing-functions-emulator.spec.mjs` 4/4 PASS: Firebase Web SDK HTTPS Callable with actual emulated Auth ID token, trusted Firestore COD paidAt/server Timestamp/idempotency and scoped Owner invoice listing/role denials.
- **IMPORTANT: App Check is deliberately OFF in this temporary demo wrapper**, NOT tested as a real attestation. Source candidate onCall `enforceAppCheck:true`, real index exports ABSENT; all Hybrid production release flags remain FALSE. No Firebase deploy or source React Build publication.
- **Verified code commit `0bf584b3` GH Actions run `39379518587`: 6/6 jobs PASS**. Hybrid focused Node **92/92**; Firestore actual Emulator **26 PASS, 2 TODO**; Firestore Rules **7 Hybrid +4 baseline PASS**; Storage **4/4 PASS**; Callable **4/4 PASS**; React source compile/Parity/Operational PASS. This is a credible demo/emulator milestone, **not production deployment clearance**.
- Remaining: finalize callable export/transport under explicit staging gate; App Check staging device validation; real independent bank transactions and Lalamove COD proof; historical ISO paidAt, credit-note/refunds, scalable paid-delivery scan, and real PC/mobile staged acceptance. Owner/Super Admin staged UI is **render-only with gate OFF**, not yet interactive with live finance API.


## 2026-10-20 — Latest GitHub-only reconciliation checkpoint

- Canonical repository `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, review **Draft PR #7**, no merge/production deploy; Mac mini purposely unused and may be behind remote commits. Preserve local noncommitted/untracked historical generated assets when eventual `git pull --ff-only`.
- Added read-only `functions/hybrid-billing-receipt-audit.js`: (a) bounded paginated all-paid-Delivery scan catches noncanonical ISO/missing paidAt + invalid financial fields, (b) `inspectHybridClosedDayAdjustments` rereads immutable closed-day seals and paid-receipt evidence transactionally and reports late-paid orders/refund deltas WITHOUT mutating original invoice/creating a credit note. Both are Super Admin-only `audit`/`adjustments` actions through internal gated finance API, input allowlisted, still NOT exported to Production.
- Super Admin `HybridBillingFinancePanel.jsx` now has staged READ-ONLY audit inventory and closed-day adjustment review sections, guarded behind `HYBRID_FINANCE_UI_READY=false` and no live callable invoker. No ISO paidAt auto-conversion, no auto credit notes.
- **Latest verified code CI:** `f47510c7`, run `39397207041`, 6/6 GitHub Actions jobs PASS. Focused Hybrid **96/96**, Firestore Emulator **31 PASS+2 TODO**, Rules **7 Hybrid+4 legacy PASS**, Storage **4/4**, real demo Auth+Functions Callable **4/4**, React source build/Parity/Operational PASS.
- **Do not claim production-ready:** original paidAt migration and credit-note authorization/write logic are still NOT built, audit hard limit 3,000, real bank/provider attestation missing, live App Check and PC/mobile staging UAT pending. Financial release flags OFF and candidate exports absent. To continue, prioritize independently verified historical receipt migration and immutable reviewed adjustments, then product-visible staged integration and full external UAT, keeping original invoices untouched until approvals.


## 2026-10-20 — Recursive handoff instruction (must carry into every future chat)

- User explicitly requires a **fresh, copy-paste-ready new-chat prompt** near the end of EVERY chat/when token or chat quota may run low, WITHOUT being asked repeatedly. The prompt must itself include the SAME instruction for the following chat (recursive).
- Canonical maintained template with current GitHub-first branch/PR/verified CI, safety constraints, remaining work, and recursive meta-rule: **`docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`, last section headed `HANDOFF CONTRACT — 2026-10-20`**.
- At every handoff, refresh both `docs/NEXT_CHAT_HANDOFF.md` and `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md` with verified latest repository state, and paste the complete up-to-date prompt to the user. Do not claim the app monitors quota or auto-runs background tasks; prepare handoff during the current turn.

---


## 2026-10-20 — Phase 3M: independently-attested historical paidAt correction candidate (GitHub-only; NOT LIVE)

- Worked solely in `Natchanon45/food-order-app` on `feature/hybrid-billing-github-first`, Draft PR #7. Current verified **code commit `f71c0f2818fe32166976a69aef25f57338e42d21`**, GitHub Actions PR workflow **39399801570 = 6/6 jobs GREEN**. Hybrid focused tests **100/100 PASS**; real isolated Firestore Emulator **33 PASS + 2 explicit TODO**; Auth+Functions, Auth+Firestore Rules (incl legacy baseline), Auth+Storage, React source compile, parity and operational jobs PASS. These are **GitHub/Emulator results, NOT staging/provider/App Check or production acceptance**.
- New **UNEXPORTED** `functions/hybrid-billing-historical-repair.js`: a server-only correction candidate that **refuses to operate without an independently queried bank/Lalamove payment-verification adapter**. Attestation must bind exact tenant/order, recent check, THB and verified gross amount, hashed immutable evidence, bank recipient/platform account or Lalamove provider COMPLETED+COD settled status. The checked-in repository has **NO live independent resolver**; uploaded slip, ISO string or browser data cannot substitute.
- In a Firestore transaction: re-check active Super Admin identity, Hybrid tenant and paid Delivery order, reject a valid canonical receipt, verify receipt gross amount, claim payment reference against duplicate histories and bank billing settlements, write a separate immutable `hybridBillingReceiptCorrections` audit case, and only then stamp canonical Firestore `paidAt` plus case ID on the affected order. Replays with identical verified evidence are idempotent; changed evidence, another order or reused reference fail closed.
- Reconciliation **NEVER** overwrites a sealed invoice/day digest, creates a settlement, issues a credit note or triggers a refund. Already-sealed days are explicitly marked `adjustmentReviewRequired`; later billing still fails closed on changed seals. One real Firestore test proves legacy ISO row repaired with synthetic independent-attestation fixture, original invoice/seals unchanged and +5,500 THB late-source discrepancy requiring manual review. Another proves actor/amount/reference enforcement. External bank/provider attestation is mocked **only in tests**.
- Other release gates remain: implement and audit ACTUAL authenticated independent bank statement/provider adapters and retained evidence, immutable approved credit/debit notes and refund disposition, >3,000 lifetime paid-row scalable canonical receipt ledger/indexes, real Lalamove COD provenance/webhook signature replay protection, real App Check device/domain staging validation, Finance/COD callable wiring only in reviewed staging, full PC/mobile Owner+Super Admin UAT, explicit human Production release approval.
- Keep `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. Do NOT export the historical repair candidate or existing COD/Finance/Daily prototypes from `functions/index.js`; no production Rules/Functions/Hosting/index deploy, no real tenant/order/payment writes, no Merge. Preserve Mac uncommitted work/24 historic hashed JS assets; no reset/clean.
- **Next exact work:** design approved credit/debit note ledger bound to immutable original invoice and reviewed post-close discrepancy; devise per-cycle scalable provenance receipt snapshots without breaking transaction limits; integrate real independent bank/Lalamove verification in isolated staging credentials; enforce App Check and test authenticated PC/mobile workflow. Leave all monetary activation behind manual release approval.


## CURRENT COPY/PASTE NEW-CHAT COMMAND — 2026-10-20 (Recursive handoff required)

> Continue PENGUIN Hybrid Billing **without restarting**. Repository `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, Draft PR https://github.com/Natchanon45/food-order-app/pull/7. Do not merge/deploy or enable money gates without explicit approval.
>
> FIRST read latest appended sections of `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`; check actual GitHub branch HEAD, Draft PR, latest commits and GitHub Actions before touching code.
>
> LAST VERIFIED SOURCE code commit `f71c0f2818fe32166976a69aef25f57338e42d21`: six GitHub Actions jobs GREEN in run 39399801570; focused Hybrid Node **100/100 PASS**, real Firestore Emulator **33 PASS + 2 TODO**, Auth/Functions/Rules/Storage + React compile/parity/operational PASS. Later documentation commits may make branch HEAD newer; ALWAYS check actual live commit and rerun CI. No real App Check/bank/provider/PC-mobile staging completion is evidenced.
>
> DONE: signup-anniversary cycle/day-close Delivery-only calculation, immutable invoice/daily seals, manual settlement and guarded recovery candidates, reviewed Rules+Storage, gated Owner/Super Admin JSX, read-only legacy ISO `paidAt` and post-close adjustments review. New UNEXPORTED `functions/hybrid-billing-historical-repair.js` offers evidence-attested, transactionally idempotent correction **only after an independently verified bank/Lalamove adapter exists** (none wired now); two real Firestore tests use MOCK attestation, preserving existing invoices/seals. Full code+test details in latest Worklog.
>
> REMAINING RELEASE BLOCKERS: real external evidence/provenance for old `paidAt` corrections (never trust ISO or uploaded slips), approved immutable credit/debit/refund ledger, paid-row scale over 3,000 and indexes, actual bank and Lalamove webhook/provider reconciliation, live App Check attestations, fully activated staged Owner+Super Admin HTTPS/Storage flow, PC/mobile UAT, explicit production approval. Two Firestore Emulator TODO remain.
>
> SAFETY: keep `HYBRID_REGISTRATION_READY`, `HYBRID_COD_CASHIER_CUTOVER_READY`, `HYBRID_FINANCE_UI_READY`, `HYBRID_FINANCE_API_READY` ALL FALSE; no production exports of COD/Finance/Daily/Historical-Repair candidates; no real-money writes, merge, Firebase deployment, or bypass of fail-closed source/Rules safeguards without approval. Work GitHub-first; Mac MCP only when necessary for safe pull/build/emulator/approved staging. Do not reset/clean/checkout away uncommitted work or 24 older untracked hashed assets on Mac. Do not confuse food-order-app with penguin_app/LUKKAJA/PHP.
>
> NEXT: build immutable reviewed adjustment/credit-note candidate with no automatic refunds or invoice rewrites; plan scalable provenance/index; test all negative cases and CI; only then stage external bank/Lalamove+AppCheck+PC/mobile tests with authorized nonproduction credentials.
>
> CRITICAL RECURSIVE HANDOFF: **BEFORE END OF THIS CHAT/QUOTA prepare a complete immediately-copyable new-chat command again** with current Repo/Branch/Draft PR/latest actual HEAD and verified code SHA/CI runs, successes, open TODOs, blockers, key files/safety gates, and exact next steps; command must contain this SAME recursive handoff requirement for the following chat. Update `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, and `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md` on GitHub. Do not ask to restart or lose context.

---

## 2026-10-20 — Phase 3N: immutable UNAPPLIED credit/debit candidates + >3,000 safe-volume UAT (GitHub-only)

- SOURCE repo `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, DRAFT PR #7 (never merged/deployed), latest VERIFIED source-code commit **`43ef8e08ec87e1e1d91584bc73576de9e8bcaa5c`**, PR GitHub Actions run **39401725967: all 6/6 jobs PASS**. Hybrid focused Node **104/104 PASS**; real Firestore Emulator **37 PASS, 2 explicit TODO**, Auth + Firestore Rules Hybrid/legacy, Auth + Storage, demo Auth + HTTPS Functions, React JSX source compilation, Parity/Operational **PASS**. A 3,001-receipt Firestore test **PASS**: read-only anomaly inventory pages all 3,001 without truncation, while invoice creation refuses to proceed beyond existing 3,000 safe cap and writes **no invoices/periods**. This is NOT high-volume production billing support; it verifies fail-closed safety.
- Added **unexported** `functions/hybrid-billing-adjustments.js` with server-only `recordHybridReviewedAdjustment`. It requires injected **independently verified, fresh, exact tenant/cycle/original-invoice and old/new SHA-256 seal-bound provenance** (NO live adapter exists). Transaction rereads Super Admin role, original invoice, frozen policy/seals, ALL paid Delivery source and canonical Timestamp coverage, recomputes locked invoice with unchanged billing topology. Rejects forged amount/source direction, missing data, receipt coverage >3,000, threshold topology changes, multiple changed days, mismatched evidence, already-used evidence and altered approvals. Browser/user never chooses adjustment cents.
- Creates a single **immutable** `hybridBillingAdjustments/{originalInvoiceId}` row and deduplicated global evidence claim, `credit_note_candidate` or `debit_note_candidate`, with `status=approved_unapplied`, `refundInitiated=false`, `settlementChanged=false`. **NOT a tax credit note, NOT applied to AR, NOT cash paid/refunded, NOT new customer invoice.** Does NOT modify original invoice, period day-seal, settlement or tenant suspension. A new source discrepancy after recording still requires manual review; underlying billing scheduler still FAILS CLOSED on prior changed seals. This is a safety stopgap, not a completed settlement system.
- Emulator examples: Paid Delivery 15,500 THB issued 775 THB; verified 1,000 THB merchandise refund calculates **50 THB UNAPPLIED CREDIT**; late 5,500 THB paid Delivery calculates **275 THB UNAPPLIED DEBIT**; idempotent replay and strict reviewer/source/threshold-denial tests PASS. External proof is **MOCKED in tests only**, not bank, Lalamove or live refund.
- Production release STILL BLOCKED: implement independently attested bank/Lalamove provider and refund data plus audit retention; actual credit-note numbering/tax and settlement/AR/reversal procedure with double-control, 3,000+ immutable receipt index and concurrency-safe day-close, verified Firestore indexes, live App Check on registered devices/domains, staged active Owner/Super Admin Functions+Storage+PC/mobile UAT, two existing Emulator TODOs, explicit human financial release signoff. NO Mac MCP, real money write, Firebase deploy, merge, production function exports or feature gate activation.
- **Next steps:** prioritize provenance-driven immutable receipt event journal and scale architecture with transaction-level read/write race tests; formally decide post-close credit/debit posting/refund/arrears reconciliation (incl settled vs unpaid invoices); integrate real bank/provider adapters in controlled staging, validate Lalamove COD signed confirmation, App Check real tokens and PC/mobile flows. Reviewed source-only notes cannot replace these tests.
- Keep `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`, all candidate exports OFF in `functions/index.js`, DRAFT PR open, no production deployment. Preserve Mac uncommitted files and old 24 hashed JS assets, no reset/clean/unsafe checkout. **Recursive next-chat handoff required in every future chat.**

## COPY/PASTE NEXT-CHAT COMMAND — after Phase 3N (recursive and mandatory)

> Continue **PENGUIN Hybrid Billing** from GitHub; do NOT restart or ask to begin. Repository `Natchanon45/food-order-app`, canonical branch `feature/hybrid-billing-github-first`, Draft PR https://github.com/Natchanon45/food-order-app/pull/7 (remain Draft; no Merge/Deploy). Last verified **code** commit `43ef8e08ec87e1e1d91584bc73576de9e8bcaa5c` (followed by docs-only commit(s); **query actual HEAD at start**), GitHub Actions PR run `39401725967` GREEN 6/6; Hybrid 104/104 PASS, real Firestore 37 PASS + 2 TODO, Auth+Functions/Rules/Storage and React source compile/parity/operational PASS.
>
> FIRST: read the **newest appended sections** of `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`, and new `docs/HYBRID_BILLING_RELEASE_GATES.md`; verify actual GitHub Branch HEAD/PR #7 status/actions, including later runs. Do not mistake old historical notes for latest state.
>
> COMPLETED: signup-anniversary Bangkok billing and closed-day Delivery 5% at threshold 10,000 THB, immutable invoice/day seals, arrears/recovery, trusted COD candidate, Security/Storage Rules and staged OFF finance Owner/Super Admin JSX, paginated historical paidAt anomaly audit, evidence-bound historical correction CANDIDATE with no live resolver. **NEW:** unexported `functions/hybrid-billing-adjustments.js` records ONE immutable reviewed but **UNAPPLIED** credit/debit candidate per original invoice, independently attested old/new day digest; never changes original invoice, payments, account, tax or refunds. Emulator tests 15,500→775 THB, refund 1,000→50 THB credit, late paid 5,500→275 THB debit, idempotence/authorization/topology denial. Separate 3,001 paid-row Firestore test proves 13-page read-only audit succeeds and invoice creation FAILS CLOSED above 3,000 (not production-scalable).
>
> BLOCKERS: actual independent bank/provider/refund attestation and historic source migration, accounting-approved legal tax credit/debit note and AR/refund settlement posting, receipt ledger scaling/index/concurrency and 2 TODO tests, real signed Lalamove COD provenance, real App Check on domain/device, staged real export/callable/Auth/Storage security, PC/mobile Owner/Super Admin UAT, explicit approved production release. No external bank/Lalamove credential/data or real App Check staging tests were available; do not invent proof.
>
> SAFETY: `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. COD, Finance, Daily, Historical-Repair and Adjustment candidates remain UNEXPORTED in `functions/index.js`. NO Firebase deploy, customer/tenant/order/payment production writes, release switches or Merge without full safety UAT and explicit user authorization. GitHub-first for edits/commits/CI; Mac mini MCP only safe pull/build/emulator or approved nonproduction stage. No reset/clean/checkout that could destroy uncommitted Mac files or 24 old hashed build JS assets. Do not confuse repository with Flutter penguin_app/LUKKAJA/PHP.
>
> NEXT ACTIONS: address the remaining true release blockers rather than polishing offline mock UI: propose accounting and tax credit-note settlement design (paid/unpaid and corrected day), add immutable receipt-event indexes and concurrent close writer fence, integrate verified bank/Lalamove provider in nonproduction with real approved credentials, App Check genuine tokens, UAT PC/mobile, 2 TODOs. Keep all candidates source-only until approved.
>
> **MANDATORY RECURSIVE HANDOFF:** Before this new chat ends or quota becomes insufficient, ALWAYS construct another immediately copyable **next chat command** with latest verified Repo/Branch/Draft PR/HEAD/code SHA/CI, finished work, real test results, remaining blockers, key files, exact next actions and safety gates. The next-chat command MUST itself include this SAME recursive handoff instruction so every future chat repeats it. Update `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md` and PR #7 on GitHub.

---

## 2026-10-20 — Phase 3O: atomic COD Receipt Journal, strict closing fence and real concurrency UAT (GitHub-only)

- Continued GitHub-only on `Natchanon45/food-order-app`, `feature/hybrid-billing-github-first`, Draft PR #7. Last VERIFIED **code SHA `17f647dc864796ed1f62bc6aa2dbbc4c760e7950`**. GitHub Actions PR run **39404559545**: **6/6 GREEN**, focused Hybrid Unit **106/106 PASS**; isolated real Firestore Emulator **41 PASS + 2 explicit TODO**; Auth+Storage, Auth+Firestore Rules including Legacy, demo Auth+HTTPS Functions, React source build/Parity/Operational all PASS. Push workflow also triggered; check GitHub current state at next startup.
- New internal, **UNEXPORTED** `functions/hybrid-billing-receipt-journal.js`, integrated with unexported COD candidate `functions/hybrid-billing-cod-payment.js`: within a single real Firestore transaction, COD order becomes server-stamped paid, an immutable `hybridBillingReceiptEvents/cod-{orderId}` entry is created, and one of 16 deterministic `hybridBillingReceiptFences/shard-00...15` versions increments. Idempotent duplicate COD calls cannot produce duplicate journal events; an already-paid COD order tagged with the trusted source but missing event now fails closed. Browser has no direct journal write path.
- `functions/hybrid-billing-ledger.js` adds SOURCE-ONLY **optional strict mode** `tenant.hybridReceiptJournalMode === "strict_v1"` which additionally REQUIRES `hybridReceiptJournalCoverageReady === true`. Inside the same closing transaction, reads the 16 shard fences BEFORE order queries, checks that all paid Delivery records in the closed-day query have a matching server-owned COD journal and verified original paid timestamp/amount, then still uses existing 3,000-row safe scan/immutable invoice logic. A participating receipt writer overlapping the close creates a Firestore transaction conflict/retry; an order committed after an earlier close remains a late adjustment, NEVER a silent rewrite. The mode is NOT enabled for Production, NOT source-certified for non-COD writers and does NOT yet validate all historical cross-cycle receipts.
- Real Firestore Emulator added atomic two-call receipt + one shard version; strict uncertified tenant denied; fake `CoverageReady=true` alone still cannot legitimize unjournaled paid Delivery; strict 10,000+5,500 trusted COD → 775 THB closed-day invoice, idempotent close; carefully orchestrated concurrent COD writer vs day-close yields either complete inclusion, transaction abort+safe retry, OR original immutable invoice plus follow-up **HYBRID_CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT**. NO silent amount replacement.
- Diagnosed failed intermediate CI: one cold GitHub runner's JDK probe exceeded the previous 5-second timeout (not a Firestore data failure), and a first concurrency test waited for a writer while holding a read lock, deadlocking the TEST. Increased isolated demo Java probe to 30 seconds; changed race test to release the pause BEFORE awaiting the COD writer. **Only final verified `17f647dc864796ed1f62bc6aa2dbbc4c760e7950` is the accepted green checkpoint**; prior failed/cancelled runs are not claimed green.
- **Important unreleased limitations**: only trusted COD writer writes this journal, not PromptPay, Lalamove provider settlement, historical repair, partial/full refunds or other Admin SDK writes; shard 16 is NOT proven 10k/100k throughput; per-cycle lifecycle/manifest/backfill plus immutable corrections and independent provider evidence remain unimplemented; old >3,000 scan cap persists and prevents high-volume invoice issuance. `hybridReceiptJournalCoverageReady` has no production certification workflow and MUST stay unset for real tenants. Genuine Firebase App Check/web+device staging, real bank statement or provider COD verification, legal tax credit/debit notes, settlement/refund posting and PC/mobile UAT are still absent.
- **Safety unchanged:** keep `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. Do not export COD/Finance/Daily/Repair/Adjustment/Journal candidates from `functions/index.js`, enable strict coverage for a real tenant, deploy any Firebase service, merge, mutate real money records or touch the Mac workspace. Preserve older uncommitted hashed assets and no reset/clean.
- Next highest-priority engineering: server-authoritative receipt events for *every* trusted payment/refund provider; an independently audited immutable day-manifest enrollment/backfill protocol with exclusive close writer fence and safe immutable late adjustment; staged Firestore indexes and >3,000 performance/transaction cutoffs. Then real bank/Lalamove attestation, App Check tokens, legal accounting notes and recorded PC/mobile UAT plus user approval.

## IMMEDIATELY COPYABLE NEXT CHAT COMMAND — Phase 3O (recursive handoff REQUIRED)

> Continue **PENGUIN Hybrid Billing** from GitHub now, without starting over, asking permission again, or confusing it with Flutter penguin_app/LUKKAJA/PHP. Repository `Natchanon45/food-order-app`; branch `feature/hybrid-billing-github-first`; Draft PR https://github.com/Natchanon45/food-order-app/pull/7.
>
> FIRST read the *newest appended sections* of `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`. Check actual PR #7 state and the newest Branch HEAD/commit/GitHub Actions runs on GitHub before making edits; documentation commits after the last code change may move HEAD.
>
> LAST VERIFIED **CODE** SHA `17f647dc864796ed1f62bc6aa2dbbc4c760e7950`, GH PR CI `39404559545` **6/6 jobs GREEN**: Hybrid focused 106/106 PASS, real Firestore Emulator **41 PASS + 2 TODO**, Auth/Functions/Rules/Storage and React JSX source compile/parity/operational PASS. New internal atomic COD event journal `functions/hybrid-billing-receipt-journal.js`, sharded 16-way version fence and unexported strict invoice transaction coverage guard; tested concurrent writer/close and immutable late adjustment. Intermediate runs had an environment Java probe timeout and a test-induced Firestore deadlock; both were fixed before this green checkpoint.
>
> DONE: anniversary-day billing 590 THB OR closed-day Delivery 5% after threshold 10,000, 15,500 THB trigger-day →775 THB, immutable invoices/seals, arrears/guarded recovery, source-only COD, bank-slip/manual finance candidate and gated Owner/Super Admin UI, Security/Storage Rules, historical ISO paidAt audit/evidence-bound correction candidate, UNAPPLIED immutable credit/debit adjustment candidate (1,000 refund →50 credit; 5,500 late paid →275 debit), 3,001-row fail-closed scan and COD event journal. **None of these authorize Production release**.
>
> REMAINING RELEASE BLOCKERS: every non-COD paid/refund writer must participate in immutable receipt ledger and close fence; audited cross-cycle journal coverage and provenance-safe legacy migration; scalable >3,000 paid-row issue path and staged indexes/10k+ load; real independently verified bank/Lalamove webhook/COD/refund settlement and tamper-resistant evidence; tax-approved credit notes/refund/AR posting with dual review; authentic Firebase App Check on staging domain/device; staged callable export and interactive Owner/Super Admin PC/mobile Auth/Rules/Storage testing; 2 TODOs and explicit human release approval. No live provider integration, App Check attestation, production deployment or merge.
>
> SAFETY: Keep `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. Do NOT export candidate functions, set a real tenant's `hybridReceiptJournalCoverageReady`, change real money/tenant/order/payment, merge PR, or deploy Firebase. GitHub-first edits/commit/CI. Mac mini MCP only if truly needed for safe pull/build/emulator/approved nonproduction staging; NO reset/clean/checkout of uncommitted data or 24 existing hashed assets.
>
> NEXT immediate task: implement a reviewed server-only receipt event/write contract for every trusted payment/refund source, coordinated day manifest/barrier and historical coverage certification; audit high-volume index strategy and concurrent late adjustments. Then stage real bank/Lalamove/AppCheck and PC/mobile with user-provided nonproduction authorization. Keep Draft PR blocked pending acceptance.
>
> **MANDATORY RECURSIVE HANDOFF FOR EVERY CHAT:** Before current chat ends or quota is low, prepare another **fully copy-pasteable new chat command** with current Repo, Branch, Draft PR, actual latest HEAD and verified code SHA/CI, completed work/tests, blockers, key files, explicit prohibitions and immediate next steps. The NEXT command must CONTAIN THIS SAME recursive handoff requirement. Update `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md` and Draft PR #7 on GitHub before ending. Never lose context or ask to restart.

---

## 2026-10-20 — Phase 3P: read-only lifetime receipt journal audit and integrity verification (GitHub-first, NOT LIVE)

- Draft PR #7 remains unmerged. Last verified **CODE commit `ef476e3990da1cd1d53f9f5d3a24fae3f8d80db9`**; GitHub Actions push + PR jobs GREEN 6/6 on run **39406104246**, focused Hybrid **107/107 PASS**, real isolated Firestore Emulator **44 PASS + 2 explicit TODO** (46 total), Security/Rules/Storage/Auth Functions/React build/Parity and Operational jobs PASS. No Firebase deploy, Mac MCP or real money operations.
- Extended internal UNEXPORTED `functions/hybrid-billing-receipt-journal.js` with `journalReceiptIssue`: strict transaction verifier compares **tenant/order, exact Firestore paidAt timestamp, original total gross cents, net merchandise cents, currency THB, trusted COD writer source, expected SHA-derived shard, Bangkok sourceDay and actor UID** to the server-owned immutable journal event. Rejects event tampering, changed order amount, missing or unsupported source, legacy string timestamps, refund not represented in journal, mismatched day/shard/time; changes are never silently included in a sealed invoice.
- Added `inspectHybridJournalCoveragePage({db,tenantId,afterId,pageSize})`: a **read-only**, paginated independent inventory over all historical paid Delivery source records (including old ISO, non-COD, receipts outside a current billing window); rejects non-Hybrid tenants/bad cursors, distinguishes `noncanonical_paid_at`, `unsupported_payment_source`, `missing_journal` and integrity issues. Supports legacy short order IDs as page cursors. Reports `coverageCertified:false` ALWAYS and NEVER writes/certifies any tenant flag. Caller is NOT a callable; a future Super Admin wrapper must authorize access independently. Cross-page scans are NOT a consistent snapshot, so these findings cannot form a production coverage certificate.
- Added focused negative tests for forgery (gross/merchandise mismatch, forged sourceDay, shard, refund, client-date, unsupported source) and Firestore Emulator tests for paginated mixed COD/legacy audit, old short cursor, no tenant flag writes, and strict invoice denial on tampered journal followed by valid 775 THB after synthetic repair. Real payment and provider signatures remain UNTESTED.
- Remaining blocker: independently attested PromptPay, Lalamove, refunds, historical payment and all other trusted writers must journal atomically; an explicit writer-coordinated day-manifest **coverage certification** and 3k+ scalable close/index algorithm are not implemented. App Check real domain/device, legal credit/debit notes, actual verified bank payments and refunds, full PC/mobile staging UAT, 2 TODO tests and human go-live approval all remain BLOCKED.
- Flags remain `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. Do not export journal/finance/COD/daily/repair/adjustment candidates in `functions/index.js`; never set `hybridReceiptJournalCoverageReady` for a real tenant or deploy/merge. Preserve Mac uncommitted work and existing hashed JS assets without reset/clean. Next: source-specific trusted adapter contracts + refund event journal and snapshot consistency, then staging only with genuine external evidence. 

## NEW-CHAT COPY/PASTE COMMAND — Phase 3P (RECURSIVE HANDOFF REQUIRED)

> Continue **PENGUIN Hybrid Billing** on GitHub; do NOT restart or ask to begin. Repository `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, Draft PR https://github.com/Natchanon45/food-order-app/pull/7. Last verified CODE SHA `ef476e3990da1cd1d53f9f5d3a24fae3f8d80db9`; run `39406104246` GREEN 6/6 (Hybrid Unit **107/107 PASS**, real Firestore Emulator **44 PASS + 2 TODO**, Auth+Functions/Rules/Storage and React JSX source compile/parity/operational PASS). A newer **docs-only** HEAD will follow; check ACTUAL GitHub HEAD and CI.
>
> FIRST read newest appended sections of `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`; check latest actual Branch HEAD, Draft PR #7 state/commits and GitHub Actions. No Mac pull, merge or deploy just to inspect.
>
> DONE: Bangkok signup-anniversary 16 Oct→16 Nov billing; Delivery 10,000 THB threshold and CLOSED full trigger-day 15,500→5% =775 THB; immutable invoice/day seals; guarded arrears and manual recovery, candidate COD/Finance/Owner/Super Admin JSX all gated OFF; audit legacy noncanonical paidAt, mock-attested historical corrections; immutable UNAPPLIED credit/debit adjustment (1,000 THB refund→50 THB candidate credit; late 5,500→275 THB candidate debit), 3,001-row fail-closed billing; atomic COD Receipt Journal with 16 sharded fences and concurrent-close Emulator UAT.
>
> NEW Phase 3P: `functions/hybrid-billing-receipt-journal.js` has stricter original-payment amount, time, sourceDay, shard, trusted actor and currency integrity checks and `inspectHybridJournalCoveragePage` scanning ALL paid Delivery historical data paginated without ANY write. Distinguishes legacy ISO/non-COD/missing journal; legacy short ID cursor works. NEVER sets coverage certification, reports `coverageCertified:false`. Unit+real Firestore Emulator negative tests GREEN. **This is NOT full consistent-snapshot source certification.**
>
> BLOCKERS: trusted external bank/Lalamove/PromptPay/refund/historical writers still NOT all journaled and verified; no full stable close manifest + writer-wide barrier + 3k+ scalable index; no genuine provider signature or bank evidence; no legal applied tax credit/debit/refund/AR settlement; no authentic staged App Check device/domain; no complete authenticated PC/mobile UAT; 2 Firestore TODOs unresolved; no user go-live approval.
>
> SAFETY: `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`; NO `functions/index.js` exports of COD/Finance/Daily/Journal/Historical/Adjustment prototypes. Do NOT certify real tenant receipt journal coverage, use client ISO/slips as external proof, write real money, merge Draft PR or deploy Firebase without verified external provider, real staging UAT, approved financial/security signoff and explicit user consent. GitHub-first commits/tests/CI; Mac mini MCP only necessary safe pull/build/emulator/approved staging; never reset/clean/checkout away uncommitted data or 24 preexisting hashed JS assets. Do not confuse with Flutter penguin_app, LUKKAJA or PHP.
>
> NEXT IMMEDIATE: build true source-specific verified PromptPay/Lalamove/refund receipt-writing contract behind a server-only adapter, cover all source events with immutable reviews and test failure/replay; design writer-coordinated consistent coverage snapshot, >3,000 close and real staging indexes; finish 2 TODOs if safe, then real external evidence, App Check, PC/mobile UAT. Keep production gates closed.
>
> **MANDATORY RECURSIVE HANDOFF EVERY CHAT:** Before this chat ends or quota low, create a fully copyable new-chat prompt WITH actual current repo/branch/Draft PR/HEAD/code SHA/CI, completed + verified tests, blockers, important files, prohibitions and exact next actions. This prompt MUST include THIS SAME recursive handoff clause for the next chat. Update `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md` and Draft PR on GitHub every time. Never restart.

---

## 2026-10-20 — Phase 3Q: independent-bank PromptPay receipt producer (CANDIDATE, not deployed)

- Canonical repository `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, **Draft PR #7 remains open and unmerged**. Last verified **CODE commit `7fd2c715ee413258c02512edd4aeebd6bb292e51`**. GitHub Actions push + PR **6/6 jobs PASS** at PR run `39407869462`, Hybrid focused Unit **110/110 PASS**, real isolated Firestore Emulator **48 PASS + 2 TODO** (50 total); Auth + Functions/Firestore Rules including legacy baseline, Storage Rules and React source compile/parity/operational jobs PASS. Checks are demo/emulator only, NOT live provider attestations, genuine App Check or PC/mobile staging.
- New **UNEXPORTED** `functions/hybrid-billing-promptpay-payment.js` with internal `verifyPromptPayBankProof` and `recordHybridVerifiedPromptPay`. No real independent bank resolver installed; absent injected SERVER-OWNED resolver fails closed with `HYBRID_PROMPTPAY_BANK_ADAPTER_NOT_CONNECTED`. Never expose resolver to clients or let browser/slip author `verified`, amount, timestamp, bank reference, tenant/order, recipient.
- A future server adapter MUST independently attest fresh verified bank transaction: exact tenant/order, THB, recipient + platform bank account, evidence SHA256, bank reference, gross THB cents, actual provider/bank paidAt and checkedAt. Internal Firestore transaction verifies active genuine Super Admin, enabled active Hybrid tenant, eligible delivered and unpaid PromptPay Delivery, gross cents matching original Order, and globally deduplicates normalized bank reference against `platformHybridPaymentReferences` (including prior invoice settlement claims). In SAME transaction, creates immutable bank receipt `hybridBillingReceiptEvents/bank-{orderId}`, updates sharded version fence and stamps order `paidAt` with evidence-attested Firestore Timestamp. No automatic refund, AR offset or invoicing and NO production writes.
- Extended `functions/hybrid-billing-receipt-journal.js` with `prepareBankReceiptJournal` and source-driven event lookup, so strict local invoice candidate can verify mixed trusted COD and mock-bank PromptPay records. Journal verifies original gross/net amounts, exact paidAt, reference/evidence SHA, sourceDay, THB, shard, actor and tenant/order. Duplicate provider-bank reference across different orders rejects. Existing paid retries are idempotent ONLY when BOTH event and global bank claim match and **journal receipt integrity** is still valid; tampered COD and PromptPay events fail closed on replay.
- Added synthetic emulator tests: first independent bank Payment + idempotent replay, second Order same bank Reference rejected, mixed 10k COD + 5.5k bank PromptPay closed day produces original immutable 775 THB invoice, tampered evidence stops strict invoice, altered COD gross or bank sourceDay refuses replay. Mock provider is **only injected in tests**, not verified with real bank APIs.
- **Still BLOCKED:** independently queried production bank/PromptPay adapter with signed/auditable recipient proof, actual Lalamove COD provider/settlement, independent refund verification and all other writer paths; consistent full coverage certification and receipt event manifest; >3,000 paid order scalable billing, transaction cutoffs and real indexes; legally approved credit/debit notes and refund/AR settlement posting; actual App Check device/domain staging and full Owner/Super Admin PC/mobile UAT; 2 Firestore TODOs and human financial go-live approval. Feature gates and strict real-tenant coverage OFF.
- SAFETY: all `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. Do not register/export PromptPay/COD/Finance/Daily/Journal/Repair/Adjustment prototypes in `functions/index.js`, do not merge/deploy, do not run on production tenant, do not approve based on mock bank data, never reset/clean Mac uncommitted files or 24 historic hashed assets. GitHub-first with CI.
- NEXT: implement server-verifiable provider adapter contracts and test real bank/Lalamove sandbox with authorized nonproduction credentials; append trustworthy refund reversal events via same writer fence; independent cross-cycle manifest and immutable late-adjustment lifecycle; nonproduction indexed >3,000 close benchmarks; actual App Check staging, PC/mobile UAT, clear remaining TODOs and financial signoff. Continue from existing source, not a rewrite.

## COPY-PASTE NEXT CHAT — Phase 3Q (RECURSIVE HANDOFF REQUIRED)

> Continue **PENGUIN Hybrid Billing** on GitHub without restarting or asking to begin. Repo `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, Draft PR https://github.com/Natchanon45/food-order-app/pull/7. Verified latest **CODE SHA `7fd2c715ee413258c02512edd4aeebd6bb292e51`**. PR CI run `39407869462` 6/6 GREEN, Hybrid Unit **110/110 PASS**, Firestore Emulator **48 PASS + 2 TODO**, Auth/Functions/Rules/Storage and React JSX compile/parity/operational green. A later docs commit may make actual HEAD newer: verify.
>
> FIRST read latest appended sections of `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md`, and `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`. Check latest actual GitHub HEAD, Draft PR #7 status, code commits, and Actions before changes. Work GitHub-first (commit/CI); use Mac mini MCP only safe approved pull/build/emulator/staging, never reset/clean/checkout uncommitted files/24 old hashed JS assets.
>
> DONE: signup-anniversary cycle e.g. 16 Oct→16 Nov, paid Delivery full day threshold 10,000 and 15,500×5%=775 THB closed-day charge, immutable invoice/seal, arrears and manual recovery, gated Owner/Super Admin UI and security candidates; noncanonical historical paidAt audit/mock-attested repair; immutable unapplied credit/debit candidates (1,000 THB refund→50 credit, 5,500 late→275 debit), 3,001-row fail-closed audit; 16-shard atomic COD journal and source integrity/paged historical audit with safety race tests.
>
> NEW Phase 3Q: `functions/hybrid-billing-promptpay-payment.js` source-only candidate for **independent bank-verified PromptPay**, requiring an injected trusted server-only resolver (NONE REAL EXISTS). Checks matching THB, recipient, reference, freshness, amount, tenant/order, active Super Admin and tenant. One Firestore transaction stamps original provider-paidAt and creates immutable `bank-{orderId}` event/16-shard writer fence, global normalized bank reference claim against invoice settlement claims. COD + PromptPay strict mixed example 15,500→775 PASS in synthetic emulator; duplicate reference rejected and tampered COD/bank paid event fails replay. NO browser callable or live provider connection.
>
> STILL BLOCKED: real bank/PromptPay provider, signed Lalamove COD and independent refund evidence; all payment/refund/historical writers journaled and synchronized; certified immutable day manifest and >3,000 production-scale indexes/load; approved legal credit/debit/refund/AR posting; genuine Firebase App Check staging device/domain tokens; Owner/Super Admin PC/mobile E2E/UAT; two remaining Firestore TODOs; explicit human go-live approval.
>
> STRICT SAFETY: `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. Keep all hybrid COD/Finance/Daily/Journal/Historical/Adjustment/PromptPay candidates UNEXPORTED from `functions/index.js`. Do not set `hybridReceiptJournalCoverageReady` for real tenants, trust browser ISO/slips as bank proof, mutate real orders, merge, or deploy Firebase before full release gates and explicit user consent. Do not confuse this repo with Flutter penguin_app, LUKKAJA, PHP.
>
> NEXT IMMEDIATE: close refund reversal ledger and provider attestation contracts (without fake production bank integration), design stable writer-coordinated coverage day manifest and high-volume scaled verified receipts, add staged approved index testing, real bank/Lalamove + App Check sandbox with credentials, PC/mobile UAT and signoff. Validate through GitHub CI, updating Draft PR.
>
> **MANDATORY RECURSIVE HANDOFF EVERY CHAT:** Before this chat ends/quota is low, prepare a complete immediately copyable NEW-chat command listing actual Repo, Branch, Draft PR, latest actual HEAD and last verified CODE SHA/CI, completed verified work/tests, remaining blockers, key files, safety prohibitions and exact next actions. That NEXT-chat command MUST include this SAME recursive handoff instruction, every future chat. Update `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md` and Draft PR #7 on GitHub before ending. Never lose context or start again.

---

## 2026-10-20 — Phase 3R: independently settled refund reversal journal candidate (NOT LIVE)

- Continued SOURCE-first on GitHub repo `Natchanon45/food-order-app` branch `feature/hybrid-billing-github-first`, Draft PR #7. Latest VERIFIED **CODE SHA `daeeef2a75415fab0b6700d0e543ff8da765d64a`**; push and PR CI both GREEN; PR run **39409749508 6/6 PASS**. Focused Hybrid Unit **113/113 PASS**, real Firestore Emulator **50 PASS + 2 TODO** (52 tests); Auth+Functions, Firestore Rules and legacy baseline, Storage and React compile/parity/operational PASS. No genuine bank/protocol refund verification or staging testing.
- Added UNEXPORTED `functions/hybrid-billing-refund-reversal.js` with `verifyIndependentRefund` and `recordHybridVerifiedRefund`. A bank refund is **ALREADY SETTLED outside this system**; the candidate never initiates any bank transfer, marks AR paid, applies invoice credit or creates a tax credit note. There is **NO real independently querying bank provider adapter**. Missing injected privileged verifier hard-rejects; browser slips, manually authored timestamps, money amount or a `verified:true` client flag are never proof.
- Requires fresh independent bank refund provenance: exact tenant/order/currency THB, global unique normalized settlement reference, immutable SHA256 evidence, positive integer refund cents, bank-debited / recipient-confirmed / refund-settled flags, canonical settledAt not before original paidAt, active Super Admin and valid original COD/PromptPay journal. Transaction checks one-refund-per-order limit and refund no greater than original merchandise, atomically claims `platformHybridPaymentReferences`, writes `hybridBillingReceiptEvents/refund-{orderId}`, increments existing 16-way receipt version fence and records evidence-bound `refundTotal` on paid Delivery order. Idempotency allowed only if unchanged proof, global bank claim, both payment/refund journals and order match. Refunds without adequate evidence, a second refund or tampering FAIL CLOSED.
- Extended `functions/hybrid-billing-receipt-journal.js`: checks original payment event gross/merchandise and refund event together. Current merchandise = original merchandise minus attested refund, with original paidAt preserved. Strict close and read-only audit load refund journal when refund fields exist. The original sealed invoice/daily digest/settlement is NEVER rewritten; post-close refund still triggers `HYBRID_CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT`, requiring separate immutable unapplied credit review.
- Synthetic Firestore Emulator tests cover 15,500 THB paid COD with 1,000 THB already-settled verified refund, original 775 THB invoice unchanged, idempotency, review authorization, over-refund, ref reuse conflict, forged event and refund-before-original-payment denial. Actual independent adapter in tests MOCKED; **not evidence of real bank refund**. Candidate currently permits **one independent settled refund event per order**, NOT multiple partial refunds, bank payout initiation, reversal chains, fully reviewed legal credit/debit notes or live refund payments. Under-construction Code Commit `4c2d3fa1` failed older Unit assertion; fixed in green `daeeef2a75415fab0b6700d0e543ff8da765d64a`; retain failure history.
- Remaining release blockers: genuine independently queried bank/PromptPay/refund data, signed Lalamove COD evidence, all writers journaled, multi-refund chain and complete trustworthy coverage certification, scalable >3,000 full paid-row issuance and staging Firestore indexes, legal Thai tax credit/debit and AR posting, real App Check domain/device, authenticated Owner/Super Admin PC/mobile staging UAT, 2 Emulator TODOs, and explicit human financial/security approval.
- Safety: keep `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`; all source-only COD/PromptPay/Journal/Refund/Finance/Daily/Repair/Adjustment candidates UNEXPORTED from `functions/index.js`. PR stays DRAFT, no Firebase deploy, real customer/tenant/order/payment writes, Mac reset/clean or Merge. Continue GitHub-first, use Mac MCP only for authorized safe pull/build/emulator/staging.

## Immediately copyable NEXT CHAT COMMAND — Phase 3R (recursive handoff mandatory)

> Continue **PENGUIN Hybrid Billing** without restarting. Repository `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, Draft PR https://github.com/Natchanon45/food-order-app/pull/7. Last VERIFIED **code commit `daeeef2a75415fab0b6700d0e543ff8da765d64a`**, PR GitHub Actions `39409749508` **6/6 PASS**, Hybrid Unit **113/113 PASS**, real Firestore Emulator **50 PASS + 2 TODO**, other Auth/Functions/Firestore Rules+Legacy/Storage/React source compilation/parity/operational PASS. A docs-only HEAD may be newer: inspect ACTUAL branch HEAD, PR #7 and Actions before editing.
>
> FIRST read **newest appended updates** of `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md` and `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`; check actual branch, PR, commit, CI. Work GitHub-first; no restarts or repeated approval requests for coding.
>
> DONE in earlier phases: signup-day Bangkok cycle, closed trigger-day paid Delivery (10,000 threshold, 15,500 ×5%=775 THB), immutable invoice/day seal/arrears/recovery and OFF-gated Finance UI; historical paidAt audit and mock-attested correction; UNAPPLIED credit/debit notes (1,000 refund→50 credit, 5,500 late paid→275 debit); 3,001-row fail-closed invoice coverage; 16-shard atomically journaled COD+synthetic independently bank-attested PromptPay and concurrency-close tests, read-only historical coverage audit. All internal prototypes NOT live.
>
> NEW Phase 3R: `functions/hybrid-billing-refund-reversal.js` SOURCE ONLY for **bank refund already independently settled**, no actual refund initiation or AR/invoice mutation. Exact fresh tenant/order/THB/superadmin/evidenceSHA/reference/gross original-merchandise and actual settledAt required; no live refund-verifier adapter. In one Firestore transaction creates immutable `hybridBillingReceiptEvents/refund-{orderId}` + globally deduped bank reference, bumps 16-shard fence and applies evidence-linked `refundTotal` without rewriting original invoice. Current strict journal validates original paid receipt plus ONE per-order refund event; second partial refund not supported (fail closed). Post-close discrepancy requires separate immutable credit/debit review. Tested in real isolated Emulator with MOCK bank proof: 15,500 paid, verified settled 1,000 refund, original 775 invoice unchanged, duplicate/actor/amount/time/tampering rejection; code `daeeef2a75415fab0b6700d0e543ff8da765d64a` green. Initial intermediate Unit expectation failure at `4c2d3fa1` corrected; do not label that commit green.
>
> BLOCKERS: real bank/PromptPay/refund/Lalamove authenticated provider proof with safe credentials and signature/replay verification, multi-refund chained immutable journal, full cross-writer consistent day manifest/coverage certification, safe scalable >3k/10k+ indexes and race handling, actual tax/legal credit notes/AR refunds, true Firebase App Check domain/device, PC/tablet/mobile staging UAT, two Emulator TODOs and user financial release authorization. Do NOT claim Production done.
>
> SAFETY: `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. Do NOT export hybrid Candidates in `functions/index.js`, enable `hybridReceiptJournalCoverageReady` for real tenant, merge PR #7, deploy Firebase or modify real-money data until fully verified staging UAT and explicit approval. GitHub-first commit/CI, Mac MCP only necessary approved safe pull/build/emulator/staging; never reset/clean/checkout uncommitted Mac files or old 24 hashed JS assets. Do not confuse with penguin_app/LUKKAJA/PHP80.
>
> NEXT immediate engineering: design/implement multi-partial refund linked event chain and strict original-source coverage with controlled provider contract, independently verified Lalamove COD/replay protection, transactionally consistent manifest and >3,000 scalable receipts/indexes and UAT. Genuine bank/Lalamove/App Check staging requires authorized nonproduction credentials; continue other source-only work without asking to start.
>
> **MANDATORY RECURSIVE HANDOFF EVERY FUTURE CHAT**: Before this chat ends or quota low, create another **immediately copyable new chat command** containing Repo, Branch, Draft PR, actual HEAD + latest code SHA/CI, completed work and VERIFIED tests, remaining blockers/problems, critical paths/safety gates and next steps. That NEXT command must REPEAT this same recursive handoff requirement for every subsequent chat. Update `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md` and Draft PR #7 on GitHub. Never restart or lose context.

---

## 2026-10-20 — Phase 3S: bounded immutable multiple-partial-refund chain (SOURCE ONLY)

- Draft PR #7 on `Natchanon45/food-order-app` / `feature/hybrid-billing-github-first`, last **verified CODE commit `998c04014653aa0f60824fe3d6e8efe7bad2cac1`**; GitHub PR run **39411488858 GREEN 6/6**, push run **39411483542 GREEN 6/6**. Focused Hybrid Unit **115/115 PASS**, real isolated Firestore Emulator **52 PASS + 2 TODO** (54 total), Auth/Functions/Firestore Rules+legacy/Storage, React source compile and parity/operational all green. No real bank/refund provider or device UAT was tested.
- New **UNEXPORTED** `functions/hybrid-billing-multi-refund.js`: `appendHybridVerifiedPartialRefund` accepts ONLY already-settled, independently verified server-side bank refund proof from injected trusted resolver (NO REAL resolver installed). It extends the legacy first immutable `hybridBillingReceiptEvents/refund-{orderId}` anchor; second and later immutable `hybridBillingReceiptEvents/refundpart-{orderId}-{sequence}` events carry full SHA-256 previousDigest/digest, amount, running total, reference/evidence digest, timestamp, tenant/order/actor/shard. Chain head stored at `hybridBillingRefundChains/{orderId}`, ordered with `refundChainCount/refundChainHeadDigest` on Order. **Max 8 total refunds per Order**, fail closed beyond cap, no unbounded Firestore transaction reads.
- Each append transaction re-reads original paid COD/PromptPay journal, first settled refund, ALL prior chain events and chain head, global bank reference claim, active Super Admin, order and tenant; revalidates entire hash sequence and money conservation BEFORE any write; rejects nonmonotonic dates, reused refs, modified early event, over-refund, concurrent double-append or missing/inconsistent source. Atomic write of next immutable event, global reference claim, updated chain head/order cumulative refund, and 16-way shard fence. Existing valid reference replays idempotently **only after entire chain validates**.
- `functions/hybrid-billing-receipt-journal.js` strict close and read-only historical inventory now load bounded chain data to revalidate all refund events. Zero/one-refund legacy paths are preserved (no forced migration). Fully settled refund may bring merchandise base to zero, original invoice still NEVER overwritten. Post-close changes require reviewed unapplied credit/debit adjustment, NEVER automatic AR posting/bank transfer/tax note.
- Real Emulator synthetic scenario: 15,500 paid COD original invoice 775 THB; previously settled refunds 1,000+2,000+500 THB form 3-event chain and `refundTotal=3,500`, invoices/seals unchanged; duplicate bank proof idempotent; first/middle event tampering fails strict review; concurrent two 400 THB refund attempts after an earlier 400 THB refund allow at most one and never exceed 1,000 merchandise. Unit tests prove hash binds evidence/amount/digest and rejects tampering. **All external refund attestations here are MOCK fixtures**.
- **Known limitation / production blocker:** only chained append after existing first refund; hard cap 8 per order; no multi-provider refunds, refund reversals of refunds, real bank signed provenance, legal Thai credit-note numbering/refund settlement reconciliation, auto-application or production indexes; genuine Lalamove COD and bank API, stable cross-provider day manifest/writer fence, >3,000 paid-row invoice scale, App Check device/domain staging, PC/mobile E2E UAT and 2 outstanding Emulator TODOs remain unresolved. Finance acceptance and explicit approval are required.
- Safety unchanged: `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`; DO NOT export COD/PromptPay/Refund/MultiRefund/Journal/Finance/Daily/Historical/Adjustment Candidates from `functions/index.js`, enable real tenant coverage, merge PR, deploy Firebase or change real money. GitHub-first only; Mac files untouched (no reset/clean).

## COPY-PASTE NEXT CHAT COMMAND — Phase 3S (recursive handoff mandatory)

> Continue **PENGUIN Hybrid Billing** without restarting. Repository `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, Draft PR https://github.com/Natchanon45/food-order-app/pull/7. Last verified **CODE SHA `998c04014653aa0f60824fe3d6e8efe7bad2cac1`**, PR GitHub Actions **39411488858 6/6 GREEN**, push **39411483542 GREEN**; Hybrid Unit **115/115 PASS**, Firestore Emulator **52 PASS + 2 TODO**, Auth/Functions/Firestore Rules+Legacy/Storage/React compile+operational PASS. A later DOCUMENTATION commit may move HEAD: VERIFY actual latest GitHub Branch HEAD, PR #7 and Actions first.
>
> FIRST: read newest appended sections of `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md` and `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`. Verify HEAD/commits/CI before coding. GitHub-first changes, commits and CI. Mac mini MCP only for safe/approved staging build/emulator/pull, NO reset/clean/checkout of uncommitted files or prior 24 hashed assets. Do not ask to begin or confuse with penguin_app/LUKKAJA/PHP80.
>
> DONE: anniversary-day billing (16 Oct→16 Nov), threshold 10,000 and full closed trigger-day Delivery 15,500×5%=775 THB, immutable invoices/seals, arrears/manual recovery, gated Owner+Super Admin JSX/security, historical paidAt audit/correction candidate, immutable UNAPPLIED credit/debit candidates, >3k fail-closed original paid-scan, 16-way fenced atomic COD and MOCK bank-attested PromptPay receipt journal, concurrent-close test, paged coverage audit, one settled refund candidate.
>
> NEW Phase 3S: `functions/hybrid-billing-multi-refund.js` adds UNEXPORTED, bounded (max 8 total) immutable multiple partial refunds AFTER original first settled refund `refund-{orderId}`. Each additional `refundpart-{orderId}-{seq}` carries chained SHA256 digest, reference, evidence, amount, cumulative money and exact settlement time. `hybridBillingRefundChains/{orderId}` head and Order `refundChainCount/refundChainHeadDigest` validated by EVERY strict close/read-only audit; full chain re-read transactionally. Global bank reference anti-replay + actor gate + overrefund protection. Emulator green: 1,000+2,000+500 THB refunds against 15,500 paid, original 775 invoice/seal immutable; forged early event and concurrent overrefund fail closed. **Only MOCK independent bank settlement proof; NO real bank adapter**, no actual payout or tax note, no unlimited refunds.
>
> OPEN BLOCKERS: Real bank/PromptPay/refund and signed Lalamove provider validation with settled COD provenance and replay protection; full writer-wide immutable day manifest/consistent cutoff and >3,000 paid-row scalable invoice/index design; real financial/legal approved credit/debit/refund/AR posting and multi-refund/reversal business decisions; genuine Firebase App Check with physical devices and domain; authenticated Owner/Super Admin PC/tablet/mobile staging UAT; 2 Emulator TODOs; explicit finance/security release signoff. Not production ready.
>
> NEXT ENGINEERING: build UNEXPORTED independently authenticated Lalamove COD provider adapter contract + strict anti-replay tests and provider mismatch/settlement guards; address cross-source consistent day manifests and data >3,000, genuine bank/Provider/App Check only with authorized nonproduction credentials. Continue without asking to start; test via GitHub CI.
>
> SAFETY: `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. DO NOT export candidate Functions; DO NOT set real tenant `hybridReceiptJournalCoverageReady`, write real payments, trust browser ISO/slips, Merge Draft PR #7 or Deploy any Firebase Production service before gates and explicit approval. Preserve Mac uncommitted workspace and files.
>
> **RECURSIVE HANDOFF REQUIRED IN EVERY FUTURE CHAT**: Before THIS chat ends or quota is low, prepare a new fully copyable chat instruction listing repo, branch, Draft PR, actual latest HEAD/code SHA + verified Actions, completed work/tests, blockers, key files, safety gates and immediate next steps. The NEXT instruction must itself repeat this SAME recursive handoff requirement so it persists forever. Update `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md` and Draft PR #7 on GitHub before finishing.

---

## 2026-10-20 — Phase 3T: signed Lalamove COMPLETED as DELIVERY proof ONLY (unexported, NOT money)

- Continued GitHub-first on `Natchanon45/food-order-app`, `feature/hybrid-billing-github-first`, Draft PR #7. Latest verified CODE commit **`c77fe91f01f0609de0bcec3aa7565587c7d9c4e5`**. GitHub PR Actions run **39414556927: 6/6 SUCCESS**; focused Hybrid Unit **118/118 PASS**, real Firestore Emulator **54 PASS + 2 TODO** (56 total); Auth+Functions/Firestore Rules including legacy+Storage and React source compilation/parity/operational PASS. A previous code commit `106a6e65` also green, but later `c77fe91f01f0609de0bcec3aa7565587c7d9c4e5` protects signed material against tampered unsigned webhook event IDs. Tests use mock/test webhook keys and mock API lookup only: **not live Lalamove or bank settlement**.
- **Critical safety correction** in existing UNEXPORTED `functions/hybrid-billing-cod-payment.js`: a Lalamove order is now always rejected by cashier settlement candidate with `HYBRID_COD_LALAMOVE_PROVIDER_SETTLEMENT_REQUIRED`, EVEN if its delivery status is COMPLETED. Prior mock route incorrectly let completed transport status mark `paymentStatus=paid`, `lalamoveCodSettlementStatus=received`, `paidAt` and a paid journal. Existing active `functions/lalamove-webhook.js` operational delivery tracking was NOT rewritten/deployed. Lalamove completion is not proof of COD funds transferred to merchant.
- Added **UNEXPORTED** `functions/hybrid-billing-lalamove-cod-verification.js`. Requires valid recent HMAC-SHA256 webhook with same signature string/form as existing webhook path `/api/lalamove/webhook`, matching server-only API key/secret, completed delivery, timestamp within 15-minute candidate window. Independently injects **server-owned authenticated order lookup** requiring exact provider order ID, tenant, TH market, account credential scope SHA256, COMPLETED status, evidence SHA256 and fresh lookup. No real provider adapter/credentials wired. A new active Super Admin-only Firestore transaction creates one immutable `tenants/{tenantId}/hybridLalamoveCodCompletionProof/{orderId}` record and global `platformHybridLalamoveEventClaims/{eventHash}` anti-replay claim. Store only hashes and no provider secrets. **No order write, no payment, no bank claim, no receipt journal, no invoice, no AR or refund.** Delivery proof remains `delivery_verified_settlement_pending` with `codSettlementVerified=false`.
- Webhook eventId is **NOT included in the HMAC-signed data**. Replay key was hardened to sha256(apiKey + timestamp + HMAC signature), not eventId, to avoid evasion by changing an unsigned ID. Reject wrong HMAC, wrong key, stale signed event, changed event status, mismatched account scope, wrong provider status, unsigned replay, cross-tenant event reuse and forged Super Admin. Real Firestore Emulator shows proof remains delivery-only and Order still unpaid with **zero** paid financial documents.
- Production barriers REMAIN: signed and independently queried real Lalamove order on verified sandbox account with credentials and actual merchant settlement/bank/wallet evidence (Lalamove COMPLETED never implies settlement); real bank PromptPay/refunds reconciliation and all trusted writers, cross-provider immutable close manifest and proper 3k+/10k+ verified billing, legal credit/debit/AR/refund accounting, genuine App Check domain/device, PC/mobile staging UAT, 2 Emulator TODOs, human financial/security approval.
- SAFETY UNCHANGED: `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`; all Hybrid financial/Daily/COD/PromptPay/Lalamove/Refund/Journal/Adjustment candidate Functions UNEXPORTED in `functions/index.js`. Do not merge PR, deploy Firebase, set real tenant `hybridReceiptJournalCoverageReady`, touch real money, trust browser-supplied timestamps/proofs, or reset/clean Mac uncommitted files.
- Next engineering: define independent Lalamove COD remittance-to-merchant/bank settlement proof and separate immutable paid-event writer only after real documented provider/bank evidence, or continue server-side mock-only cross-source close manifest and certified high-volume writer coordination. Keep hard release gates closed. GitHub-first; no Mac MCP used in Phase 3T.

## READY-TO-COPY NEXT CHAT INSTRUCTION — Phase 3T (RECURSIVE IN EVERY CHAT)

> Continue **PENGUIN Hybrid Billing** from GitHub; NEVER restart or ask to begin. Repo `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, Draft PR https://github.com/Natchanon45/food-order-app/pull/7. Last verified CODE SHA `c77fe91f01f0609de0bcec3aa7565587c7d9c4e5`. GitHub PR Actions `39414556927` GREEN 6/6; Hybrid Unit 118/118 PASS, real Firestore Emulator 54 PASS + 2 TODO, Auth+Functions/Rules+Legacy/Storage/React source/parity/operational PASS. There may be a NEWER docs-only HEAD: verify actual branch HEAD, commits, PR and Actions before changes.
>
> BEFORE coding read newest appended sections of `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`. Check PR #7 still DRAFT and CI green. GitHub-first commits/push/CI. Do not confuse repo with Flutter penguin_app, LUKKAJA or PHP80.
>
> PRIOR COMPLETED / TESTED: Bangkok anniversary cycle (16 Oct→16 Nov) and closed full trigger-day paid Delivery 10,000 threshold, 15,500×5%=775 THB; immutable invoices/day seals, arrears/recovery, gated Owner/Super Admin UI, trusted COD candidate, historical paidAt read-only audit/mock-attested correction, immutable unapplied credit/debit adjustments, 3,001-row fail-closed scan, 16-shard atomic COD/PromptPay mock bank event journal and refund events, bounded max-8 multiple settled partial refund SHA chain and concurrency tests. Only simulator evidence; NOT production.
>
> NEW Phase 3T: `functions/hybrid-billing-lalamove-cod-verification.js` INTERNAL UNEXPORTED verifies timestamp-fresh HMAC signed Lalamove COMPLETED webhook and a separate server-owned authenticated provider order lookup with tenant/account scope, TH market, exact order ID, status, SHA evidence. Transaction stores ONLY immutable `hybridLalamoveCodCompletionProof` and global signed-material replay claim, never paidAt/paymentStatus/receipt/invoice. Replay uses signed timestamp+signature (NOT unsigned eventId). `functions/hybrid-billing-cod-payment.js` now **ALWAYS rejects Lalamove cashier COD payment based merely on COMPLETED**. Emulator verifies completion proof remains `settlement_pending`, Order stays unpaid, no paid journal, role/signature/lookup/replay tampering blocked. NO actual live Lalamove credentials/lookup or Lalamove merchant COD remittance proof is wired. Existing live operational webhook was NOT changed.
>
> STILL OPEN: real independently verified bank/Lalamove COD settlement and refund signatures/reconciliation; all trustworthy payment writers, consistent cross-provider day-close manifest/coverage certification, scalable 3k+/10k+ receipt indexes and races, approved Thai accounting credit/debit/refund/AR posting, real Firebase App Check device/domain staging, Owner/Super Admin PC/mobile UAT, 2 Firestore TODOs and explicit financial release consent.
>
> SAFETY: Keep `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`; never export any Hybrid Candidate Functions to `functions/index.js`, enable real tenant `hybridReceiptJournalCoverageReady`, accept browser slip/timestamp as proof, mark Lalamove COD paid on COMPLETED, alter real financial docs, Merge Draft PR or Firebase Deploy before verified release gates and explicit permission. GitHub-first; Mac mini MCP only safe necessary authorized pull/build/emulator/staging; never reset/clean/checkout uncommitted workspace or existing 24 hashed JS assets.
>
> NEXT IMMEDIATELY: advance one of remaining source-only blockers with concrete tests: (1) provider-signed+bank/wallet verified Lalamove COD settlement adapter contract with real credential-scope and signed order details once approved nonproduction access exists, but NO `paid` export before actual reconciliation; (2) cross-writer consistent immutable paid receipt/day manifest and >3,000 scalable billing, with Firestore emulator concurrency. Then staging App Check and PC/mobile UAT. Update Draft PR, docs and CI.
>
> **MANDATORY RECURSIVE HANDOFF EVERY FUTURE CHAT:** Before this chat ends or quota insufficient, create a FULL immediately copyable NEXT-chat prompt including repo, branch, Draft PR, current actual HEAD + last verified Code SHA/Actions, finished features + tests, unresolved blockers/problems, key paths, security prohibitions and exact next steps. That NEXT-chat prompt MUST itself repeat THIS SAME mandatory recursive handoff instruction forever. Update `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md` and Draft PR #7 on GitHub. Never restart.

---

## 2026-10-20 — Phase 3U: advisory paginated paid-receipt Manifest with writer-fence pre/post checks (NO certification)

- GitHub-first repo `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, Draft PR #7. Latest VERIFIED CODE SHA `4c78c02a48fa610ee9ea99d66c99b29d18d812bf`; PR run **39427537619 GREEN 6/6**, push run `39427531685` GREEN 6/6; focused Hybrid Unit **121/121 PASS**, real isolated Firestore Emulator **56 PASS + 2 explicit TODO** (58 total), Auth+Functions/Firestore Rules+Legacy/Storage and React compile/parity/operational PASS. Intermediate SHA `67519706` failed **unit fixture missing explicit `coverageCertified:false`**, corrected in green `4c78c02a48fa610ee9ea99d66c99b29d18d812bf`. Do not claim that intermediate CI succeeded.
- NEW **UNEXPORTED** `functions/hybrid-billing-manifest-preview.js`: bounded `previewHybridJournalManifest` reads 16 Receipt Journal shard fence versions before/after a full paginated paid Delivery source audit, consumes strict page completeness checks and source-bound page SHA256 digests, rejects missing/malformed pages, >100-page scan limit, stale/mutating registered writer fences. Output is deterministic advisory `rootDigest`, scanned count, issue counts (first 100 details), version vector, **`coverageCertified:false` and `canIssueInvoice:false` ALWAYS**. No writes to tenant flags, paidAt, journal, AR, invoice, day-seal or bank records, no callable, no Firebase deploy.
- Extended `functions/hybrid-billing-receipt-journal.js` read-only coverage pages to report SHA256 `pageDigest` over actual payment/refund financial fields, paidAt, COD/PromptPay event reference/evidence hashes and bounded refund chain head; it still inspects all paid Delivery including legacy ISO/missing/untrusted sources. No PII/secrets included in digest.
- Synthetic Node fixture tests 3,001 rows across 16 pages (pageSize 200) and detects partial reads, forged/malformed page hash, writer version change and 100-page cap. **Not a real Firestore 3,001+ load test**. Actual isolated Firestore Emulator tests 3 valid trusted COD receipts across 2 read-only pages with repeatable root and no activation, and an additional trusted COD paid transaction DURING scan yielding `HYBRID_MANIFEST_WRITER_RACE`; invoices remain 0, coverage flag unchanged.
- CRITICAL QUALIFICATION: A pre/post version vector read OUTSIDE a transaction is NOT a global atomic snapshot, cannot detect unregistered writers or mutations that do not increment fences, nor writers committing AFTER the second read. Current production invoice candidate still has a **3,000 paid row fail-closed limit**. This provisional manifest does **NOT** authorize closing invoices for 3,001+ or marking receipt coverage ready. A coordinated writer-wide stable epoch/cutoff, source certification, high-volume Firestore benchmark, index review and immutable day-manifest accounting protocol remain necessary.
- Other blockers unchanged: real independently verified bank/PromptPay/refund and Lalamove merchant COD remittance/Wallet/bank settlements, full trusted writer registry and replay security, approved legal Thai credit/debit/refund/AR posting, genuine App Check staging domains/devices, authenticated Owner/Super Admin PC/tablet/mobile staging UAT, two Firestore Emulator TODOs and explicit go-live financial/security approval. All four Hybrid feature gates FALSE; Lalamove COMPLETED still DELIVERY-only.
- SAFETY: all hybrid candidates UNEXPORTED from `functions/index.js`, no Merge PR #7, no Firebase deploy, no changes to real financial data or real tenant `hybridReceiptJournalCoverageReady`, no Mac MCP reset/clean/uncommitted file modification. Continue GitHub-first.

## IMMEDIATELY COPYABLE NEXT CHAT — Phase 3U (MANDATORY RECURSIVE HANDOFF)

> Continue **PENGUIN Hybrid Billing** from GitHub without starting over or asking permission to begin normal development. Repository `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, Draft PR https://github.com/Natchanon45/food-order-app/pull/7. Last verified CODE SHA **`4c78c02a48fa610ee9ea99d66c99b29d18d812bf`**, PR GitHub Actions **39427537619 GREEN 6/6**, push `39427531685` GREEN, Hybrid Unit **121/121 PASS**, real Firestore Emulator **56 PASS + 2 TODO**, Auth/Functions/Rules/Storage/React source/operational green. A later docs-only commit may move HEAD; verify ACTUAL GitHub branch HEAD/PR SHA/Actions before edits. Initial intermediate test SHA `67519706` FAILED a missing `coverageCertified:false` fixture; green SHA `4c78c02a48fa610ee9ea99d66c99b29d18d812bf` fixes it.
>
> FIRST read the newest appended sections of `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`. Check Draft PR #7 remains open/DRAFT and CI green. GitHub-first for code/commit/CI; Mac mini MCP only safe approved pull/build/emulator/staging, NEVER reset/clean/checkout uncommitted Mac work or 24 existing hashed JS assets.
>
> DONE BEFORE Phase 3U: Bangkok signup-anniversary billing (e.g. 16 Oct→16 Nov), 10,000 THB Delivery threshold with full closed trigger day 15,500×5%=775 THB, immutable invoices/seals, arrears/recovery, gated Owner/Super Admin UI and candidate Finance backend, historical paidAt audit/mock-backed corrections, unapplied credit/debit candidates, 16-shard atomic COD and MOCK independent bank PromptPay receipt journals, one settled refund + max-8 chained partial refunds and concurrency tests. Lalamove delivery COMPLETED proof is authenticated HMAC + mock provider lookup but **never** COD payment; cashier candidate rejects courier settlement without independently verified remittance. All source-only, unexported, NOT live.
>
> NEW Phase 3U: `functions/hybrid-billing-manifest-preview.js` internal read-only provisional paid-receipt manifest with paginated SHA-256 page witnesses from `functions/hybrid-billing-receipt-journal.js`; verifies pre/post 16 Shard Fences, checks every page/issue, fails if writer races, incomplete reads or >100 pages. ALWAYS `coverageCertified:false`, `canIssueInvoice:false`; zero data mutations. Tests: synthetic **3,001** rows across 16 pages with limit/race/failure cases; real Firestore Emulator **3** genuine synthetic COD journaled orders across two pages and concurrent trusted paid write detected; root repeatable, no invoice or flag. This **DOES NOT** prove genuine 3,001+ Firestore scalability or global transactional certification; current invoice engine STILL FAILS CLOSED beyond 3,000 paid orders.
>
> OPEN RELEASE BLOCKERS: all source writers join a coordinated immutable day-manifest + full certified stable epoch/window and replay/late-write policy; real 3k+/10k+ performance/index/load/concurrency benchmark and scalable invoicing; real signed and bank/Wallet reconciled Lalamove COD merchant settlement, PromptPay/bank/refund proof; approved Thai legal tax credit/debit and refund/AR offsets; actual App Check device/domain and authenticated Owner/Super Admin PC/tablet/mobile staging UAT; 2 Emulator TODOs; explicit human financial/security go-live approval. Don't claim production-ready.
>
> NEXT ENGINEERING: design/test a **server-only writer-wide source registry and epoch barrier** that can distinguish enrolled COD/PromptPay/refund/Lalamove payment writers from legacy/unregistered writers, then scalable manifest/index/read model with real isolated Firestore >3k test (without prematurely removing 3k invoice fail-closed). Genuine Provider/App Check staging only with authorized nonproduction credentials. Run GitHub CI, update Draft PR.
>
> SAFETY: `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. DO NOT export Prototype Finance/COD/PromptPay/Lalamove/Refund/Journal/Daily/Manifest functions to `functions/index.js`; DO NOT flip real tenant `hybridReceiptJournalCoverageReady`, convert courier COMPLETED to paid COD, trust client slips/ISO timestamps, alter real-money data, Merge Draft PR or Firebase Deploy before full release gates and explicit user approval. Do not confuse with Flutter penguin_app / LUKKAJA / PHP.
>
> **RECURSIVE HANDOFF REQUIRED IN EVERY FUTURE CHAT:** Before that chat ends or quota is low, create a FULL immediately copyable NEXT chat prompt listing actual repo, branch, Draft PR, latest HEAD/code SHA + verified CI, finished features/tests, unresolved blockers/issues, important paths, prohibitions and exact next actions. That NEXT chat prompt MUST itself repeat THIS SAME recursive handoff obligation for every subsequent chat. Update `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md` and Draft PR #7 on GitHub before ending. Never restart or lose context.

---

## 2026-10-20 — Phase 3V: independent Lalamove COD remittance vs bank credit, READ-ONLY candidate

- Actual GitHub code HEAD before documentation: `59439a586bc879ed48d5305b3bef6bbd7bf00a03` (added source `466cbed1`, unit fixtures `7d1152bb`, npm CI script `59439a58`). Repo `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, Draft PR #7. CI for this code was STARTED (push 39430335516, PR 39430346681); CHECK latest verified completed results before reporting green; earlier Phase 3U PR 39428267455 and push 39428259863 SUCCESS. Do not treat in-progress checks as PASS.
- New `functions/hybrid-billing-lalamove-settlement-preview.js` is SOURCE-ONLY/UNEXPORTED/read-only. Requires prior signed Lalamove delivery-only proof AND independent separately authenticated provider-remittance and bank-credit LOOKUPS. Strictly matches tenant, order, provider order, source, account scope, beneficiary account SHA256, THB, gross COD cents against Order total, nonnegative provider fee, exact net remittance cents, unique provider/bank evidence SHA256 and transfer reference SHA256, PAID_OUT vs POSTED, fresh server checks and time ordering. Single-order transfer only: batch payouts expressly blocked. Never infer COD money from COMPLETED or provider-reported bank claim.
- Internal `previewHybridLalamoveCodSettlement` first reads tenant, order, signed delivery proof and ACTIVE Super Admin; injected server-only adapters are NOT live integrations and MUST NEVER accept browser-produced receipts/authors. Missing registered beneficiary SHA256 fails closed. `reconcileLalamoveCodEvidence` provides testable pure comparisons. Even matched MOCK fixtures ALWAYS return `settlementCertified:false`, `canMarkPaid:false`, `paymentChanged:false`, `canIssueInvoice:false`, `coverageCertified:false`; no Firestore writes, no paidAt/paymentStatus/receipt journal/AR/invoice/tenant flag changes and no callable in `functions/index.js`.
- New `tests/react-parity/hybrid-billing-lalamove-settlement-preview.spec.mjs` covers two independently matched test fixtures, 24 mismatches/rejections including stale, spoofed scope, wrong beneficiary, batch payout and mismatched cents, denied cashier and zero DB writes. Registered in `package.json` Hybrid Node test script. Mock `authenticated:true` is a TEST CONTRACT, not independent live bank authentication.
- Still REQUIRED before money activation: documented real Lalamove remittance and Bank/Wallet APIs, credential custody, verified transfer-source provenance and signed records, batch payout allocation policy, true global bank-reference replay claims, idempotent atomic journaled payment writer and all-writer epoch barrier, immutable day manifest, >3,000 real Firestore benchmark/indexes, Thai tax credit/debit/AR approved accounting, App Check and Owner/Super Admin PC/mobile staged acceptance, 2 Emulator TODO and security/finance signoff.
- All four flags remain `false`: `HYBRID_REGISTRATION_READY`, `HYBRID_COD_CASHIER_CUTOVER_READY`, `HYBRID_FINANCE_UI_READY`, `HYBRID_FINANCE_API_READY`. DO NOT export prototypes, certify journal coverage, mark Lalamove COD paid, touch real money, deploy Firebase, merge Draft PR #7, reset/clean/checkout uncommitted Mac files.

## IMMEDIATELY COPYABLE NEXT CHAT — Phase 3V (RECURSIVE)

> Continue PENGUIN Hybrid Billing without restarting. Repo `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, Draft PR https://github.com/Natchanon45/food-order-app/pull/7. Code commit `59439a586bc879ed48d5305b3bef6bbd7bf00a03`; a later docs commit moves HEAD: CHECK current branch HEAD, PR SHA and latest push/PR Actions before modifying files. Phase 3U verified CI PR 39428267455 GREEN; Phase 3V started CI push 39430335516 / PR 39430346681, verify completion/status; DO NOT claim pending green. First read latest appended sections in `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`.
>
> DONE prior: Bangkok anniversary monthly billing, full closed trigger-day % calculation, immutable invoice/day-seal/arrears, historical paidAt audit, unapplied credit/debit, 16-shard receipt fences, trusted COD + mock independent PromptPay, max 8 chained partial refunds, signed Lalamove delivery-only proof (NOT money), Phase 3U advisory paginated hashed receipt manifest with pre/post fence, synthetic 3,001 pages and real Firestore 56 PASS +2 TODO, never certified; invoice candidate blocks >3,000. NEW Phase 3V `functions/hybrid-billing-lalamove-settlement-preview.js` pure + internal read-only Super Admin proof comparison requires an independently verified Lalamove remittance AND unrelated bank posted-credit evidence matched by scope/recipient/reference/gross/fee/net/freshness; tests `tests/react-parity/hybrid-billing-lalamove-settlement-preview.spec.mjs` wired to Hybrid CI. MOCK ONLY, no provider/bank integration, all canMarkPaid/canIssueInvoice/coverageCertified/settlementCertified FALSE.
>
> NEXT: inspect CI output and fix any errors; design source registry/writer-wide stable epoch and a true immutable day manifest; add real 3k+/10k+ isolated Firestore indexes/load/concurrency proof without lifting issuance guard; obtain explicitly authorized nonprod provider+bank settlement proof and batch transfer accounting; legal credit/debit/AR/refund posting; real App Check devices/domains; Owner/Super Admin PC/tablet/mobile UAT, close 2 emulator TODO and record finance+security approval.
>
> SAFETY: keep `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. NO export hybrid prototypes in `functions/index.js`, no real `hybridReceiptJournalCoverageReady`, no COD paid from delivery COMPLETED, no financial mutation without two independently authenticated actual evidences and release approval, NO Merge Draft PR or Firebase deploy. GitHub-first; Mac MCP only essential authorized tasks; never reset/clean/checkout away uncommitted work or old JS bundles.
>
> **MANDATORY RECURSIVE HANDOFF EVERY FUTURE CHAT:** Before finishing or quota runs low, generate a FULL copy-pasteable NEXT chat prompt containing repo, branch, PR, latest actual HEAD/code SHA/verified CI, completed work/tests, unresolved blockers, key files, safety prohibitions and exact next work. The NEXT prompt MUST carry this exact recurring handoff requirement into every subsequent chat. Update all SIX docs listed above AND Draft PR #7 in GitHub before each chat ends. Never restart from Phase 1.

---

## 2026-10-20 — Phase 3W: DEMO-ONLY epoch writer registry + transactional barrier candidate (NOT actual full coverage)

- GitHub-first `Natchanon45/food-order-app` branch `feature/hybrid-billing-github-first`, Draft PR #7. Initial verified GREEN SHA before work `253486b07d8d3f1d9f33dfdd98b08108234bf3be`, PR Actions `39430829038` 6/6, push `39430821992` 6/6, Hybrid Unit 125 PASS, real Firestore Emulator 56 PASS +2 TODO. This Phase 3W CODE SHA is `351dd6c715aa5ce0e26109d19c97bad2df833db8`; corresponding NEW CI runs are pending until VERIFIED via GitHub Actions. Do not assert green merely because files were pushed.
- NEW `functions/hybrid-billing-writer-epoch-candidate.js`: source-only UNEXPORTED **strictly demo Firestore Emulator-only** helper (requires GCLOUD_PROJECT `demo-penguin-hybrid-uat` and loopback FIRESTORE_EMULATOR_HOST). Deterministic SHA256 registry enumerates COD cashier, PromptPay bank, initial Refund, partial Refund, **missing** Lalamove COD remittance, and **unregistered** legacy paid Delivery path. Every source is declared `wired:false`, because actual finance writers DO NOT use this helper. This registry is a TODO/engineering contract, NOT a declaration of writer participation.
- DEMO `initializeHybridEpochCandidate` sets isolated `tenants/{id}/hybridBillingEpochCandidates/active` open state with `candidateOnly:true`, `coverageCertified:false`, `canIssueInvoice:false`; Super Admin + enabled hybrid tenant required. DEMO `requireHybridEpochAdmissionCandidate` reads this SAME control doc **inside the simulated writer's Firestore transaction**; rejects missing, tampered, already sealed, unregistered or future writers. DEMO `sealHybridEpochCandidate` updates control to `sealed` with audited Super Admin guard; this forces participating read transactions to serialize/retry or fail closed at boundary. Idempotent reseal returns alreadySealed. **This is NOT a real financial Day Seal or immutable certified Manifest.**
- NEW unit `tests/react-parity/hybrid-billing-writer-epoch.spec.mjs` verifies registry completeness/missing paths, demo-only guard, no functions/index export, all never-certify outputs and guard denials. Added to `package.json` Hybrid Node tests. Extended **real isolated Firestore Emulator** integration `tests/react-parity/hybrid-billing-firestore-emulator.spec.mjs` with open/admission/seal/reseal + concurrent synthetic writer vs seal scenarios; test writes ONLY `hybridBillingEpochProbes` synthetic candidate docs, no real COD/payments/invoices/flags.
- IMPORTANT: This is not installed on real COD/PromptPay/refund writers (and no Lalamove money writer exists). A finite registry cannot prove no legacy or unauthorized writers, and optimistic/pessimistic transaction locking only orders writers that read the SAME epoch control. A sealed DEMO epoch is *not* true consistent financial coverage. This implementation does NOT relax existing Phase 3U advisory manifest `coverageCertified:false`, `canIssueInvoice:false`, or 3,000-paid-order invoice fail-closed; does not change `functions/index.js`, `firestore.rules`, Firebase config or any live tenant.
- Remaining: enroll EVERY trusted source including legacy cashier/other verified payments, partner/Bank/Wallet proof, post-close refund/adjustments, immutably record a real coordinated day/source manifest and replay/late-write policy; build real 3k+/10k+ Firestore pagination/load/index/concurrency benchmark, legal Thai credit/debit/refund/AR approval, real Staging App Check PC/tablet/mobile UAT, 2 Emulator TODO, financial/security signoff before deployment.
- Safety unchanged: `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. NO prototype export, NO real `hybridReceiptJournalCoverageReady`, no financial writes, no PR merge, no Firebase Deploy, no Mac reset/clean/checkout uncommitted files.

## IMMEDIATELY COPYABLE NEXT CHAT — Phase 3W (RECURSIVE HANDOFF)

> Resume PENGUIN Hybrid Billing without starting over. Repository `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, Draft PR https://github.com/Natchanon45/food-order-app/pull/7. Last Phase 3W code SHA **`351dd6c715aa5ce0e26109d19c97bad2df833db8`**; a later docs commit may move HEAD. VERIFY current ACTUAL GitHub HEAD / Draft PR open + unmerged / latest Push and PR Actions before edits. Last VERIFIED pre-Phase3W HEAD `253486b07d8d3f1d9f33dfdd98b08108234bf3be` PR run `39430829038` + push `39430821992` GREEN 6/6; Hybrid Unit 125, Firestore 56 PASS +2 TODO. Phase 3W new code tests need fresh Actions verification, do NOT invent pass counts.
>
> FIRST read NEWEST appended sections in `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_RELEASE_GATES.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`; check PR #7; GitHub-first, Mac MCP only safe necessary staging, never reset/clean/checkout uncommitted Mac assets.
>
> DONE: anniversary Bangkok billing, immutable invoices/day seals/arrears, historical paidAt audit, unapplied adjustments, 16-shard COD/PromptPay receipt journal, 8 partial refund chain, signed Lalamove delivery proof (NOT money), mock-only independent Lalamove remittance vs bank posted credit preview (NEVER paid), Phase3U advisory paginated manifest + 3,001 *synthetic* row test and actual small Emulator race (ALWAYS not certified). NEW Phase3W source-only UNEXPORTED `functions/hybrid-billing-writer-epoch-candidate.js`: a fixed source registry (all wired:false), strictly demo emulator epoch init/admit/seal; synthetic Firestore transactions reading shared control doc must serialize/retry/reject after seal; real writers are NOT integrated. Unit `tests/react-parity/hybrid-billing-writer-epoch.spec.mjs` + 2 emulator scenarios added. Still no global consistent snapshot or real 3k+ load; invoice engine still blocks >3,000. All gates false.
>
> NEXT: verify latest Phase3W Actions and correct failures; design and implement a safe, source-only opt-in gate for COD/PromptPay/refund financial writers with exhaustive race tests, legacy/unknown source detection and full source attestation. Avoid real financial writes and do NOT certify manifest until ALL writers + source lineage + stable day cutoff are proven. Add actual 3k+/10k+ DEMO Firestore perf/index tests within budgets; real authorized bank/Lalamove Staging, credit/debit/refund AR tax approval, App Check on devices, Owner/Super Admin PC/tablet/mobile UAT, 2 Emulator TODO and explicit security+finance release signoff.
>
> SECURITY PROHIBITIONS: `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. No export candidate Finance/COD/Settlement/Manifest/Epoch modules into `functions/index.js`; no real tenant `hybridReceiptJournalCoverageReady`, no changing real money, no Lalamove COD paid solely because DELIVERY COMPLETED, no Merge Draft PR #7, no Firebase production deploy. Mac mini MCP only if indispensable; never reset/clean/checkout uncommitted files or historical JS bundles.
>
> **MANDATORY RECURSIVE HANDOFF EVERY FUTURE CHAT:** Before ANY chat ends or quota is low, write a FULL immediately copyable NEXT chat prompt with actual repository, branch, Draft PR, latest HEAD/code commit/VERIFIED CI, completed features/tests, open blockers, paths, security prohibitions, exact next steps; embed THIS SAME mandatory recursive handoff instruction INSIDE the new prompt for every future chat, perpetually. Update all six named docs plus Draft PR #7 on GitHub before ending; never restart.

