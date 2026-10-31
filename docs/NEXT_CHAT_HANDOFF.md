## 2026-10-31 — Revenue Share monthly calendar report bugfix 0.4.300 / 2026.10.31.530 (SOURCE ONLY)

- Owner screenshot after .529 Hosting deploy showed "รายเดือน" October 2026, but report subtotal/Delivery/share-result captions still showed 2026-10-21 to 2026-11-20, the tenant activation-anniversary billing period. Owner expects calendar 01/10/2026 - 31/10/2026 for monthly report, without choosing "กำหนดเอง".
- Root cause is BOTH server scope and UI: deployed Firebase getTenantRevenueShareSummary Callable interprets monthly requests as anniversary invoice periods, and React report copied server label into monthly captions. Simply replacing date text would misrepresent real money sums. Anniversary billing must remain separate for threshold and actual invoice/payment.
- Fix scoped entirely to PENGUIN frontend: new pure react-app/src/utils/revenueReportPeriod.mjs sends the existing Callable an inclusive custom 1st-to-last calendar range for monthly reports, with strict calendar/leap validation and numeric DD/MM/YYYY - DD/MM/YYYY captions. This filters real in-store/POS, paid Delivery, shipping/wallet and share outcomes to selected month. Daily/yearly/custom report filters unchanged.
- Report Progress/threshold still uses actual anniversary cycle; header labels it "รอบคิดค่าบริการ" rather than pretending to match month. If tenant payment cycle is monthly, the report additionally loads original anniversary period via a separate read so slip submissions use correct anniversary liability and period; failure of separate billing read blocks payment but does not hide report data. No Backend/Rules/Functions edits, live business-data writes or threshold/rate changes.
- Filter UX: refreshing access/report preserves selected Daily/Monthly/Yearly/Custom filter for same tenant instead of resetting to billing default.
- Calendar/filter tests, billing separation/monetary server harness and updated older finance contracts: 23/23 focused finance tests PASS; full npm run test:react-parity PASS; npm run build:react and generated HTML/assets Build contract PASS. Candidate Version 0.4.300 / Build 2026.10.31.530; new bundle index-CwKWE5gP.js. Firebase Production remains 0.4.299 / 2026.10.31.529 pending new explicit release approval. No automatic Production redeploy.
- Original main and feature/react-firebase-port, source LUKKAJA, cash receipts, wallet ledger, Firestore Rules and payment Callable unchanged.

## 2026-10-31 — Firebase Production Hosting-only 0.4.299 / Build 2026.10.31.529 VERIFIED

- Owner approved current PENGUIN Version 0.4.299, Build 2026.10.31.529, branch feature/port-lukkaja-20261031. App commit 0d310434845de2e854a01860c8fc2e21a418d711 was clean, GitHub ff-only synced before deploy. Neither main nor feature/react-firebase-port was merged.
- Firebase project chat-45754, Hosting target foodapp bound to penguin-food.web.app. Dry run PASS. Actual CLI command firebase deploy --only hosting:foodapp --project chat-45754 --non-interactive (15.34.0) reported version finalized, released, Deploy complete. No Functions, Firestore Rules, indexes, Storage or live order writes were deployed.
- HTTPS: /react/, /cashier/quick-order, /cashier, /kitchen, /cashier/table-qr, /cashier/receipt, /admin/sales-report, /reports/revenue-share, /s/tuahere-somtam/delivery all HTTP 200. Live /react/ HTML references /react/assets/index-CGo6t15E.js; previous index-DS4OlTy0.js absent. JS downloaded and verified contains Version 0.4.299, Build 2026.10.31.529, release marker LUKKAJA-PENGUIN-RECEIPT-TERMS-VISUAL-PARITY. New optional terms CSS HTTP 200.
- Full local React Parity PASS, 8/8 dedicated billing/visual tests PASS, .529 generated React build contract PASS. HTTPS smoke is not a signed-in finance test or physical print quality certification.
- Follow-up Git commit documentation-only, no new app assets; do not redeploy without a NEW Build per hosting rule. Existing .528 Cloud Functions, Firestore Rules and separate LUKKAJA Production remain unchanged.

## 2026-10-31 — Production 0.4.298 / Build 2026.10.31.528 VERIFIED (post-screenshot)

- Application code commit 7e10740c0074d71ae39a00b76283ca7590247500 was pushed on feature/port-lukkaja-20261031 before cloud deploy, main/react-firebase-port unchanged.
- Owner screenshot discrepancies handled: Quick Order Takeaway icon now inherits green theme, Cashier no longer displays completed paid Walk-ins unless table really still belongs to that order, and Kitchen can show/process only paid-but-unserved legacy operational status. No manufacturing of occupied QR tables and no change to paid totals, revenue or receipts.
- Local verification: 7/7 lifecycle source tests, Auth+Firestore Emulator 2/2, full React Parity, Vite build contract 2026.10.31.528. Firebase Function updateDeferredKitchen dry-run PASS. Targeted production function deploy produced both Successful update operation and trailing HTTP 409 warning while cloud resource was DEPLOYING; read-only Firebase functions:list initially state DEPLOYING, then subsequently ACTIVE. **Do not claim clean/no-warning function deployment**, but final resource is ACTIVE.
- Firebase Hosting target foodapp deploy complete; public /react/ HTML references hashed JS index-DS4OlTy0.js and new bundle GET HTTP 200 contains 0.4.298, 2026.10.31.528. Cashier, Quick Order, Kitchen, Table QR, Revenue Share each HTTP 200. Firestore Rules unchanged in this release.
- This is a source-code/UI state fix, not manual repair of the specific Q001 production document. No gcloud read-only token was available to inspect real Q001, so whether it was already served or table really occupied remains unverified; do not auto-correct monetary or table documents without evidence. Receipt of THB 255 may correctly appear in sales when paid first.
- Owner/browser validation still requested: reload Cashier, Kitchen and Table QR side by side and verify whether Q001 is unfinished vs fully served/closed. If Kitchen still shows nothing while actual Q001 unserved, gather exact status/items/table marker using authorized read only before modifying data.

## 2026-10-31 — Walk-in paid-first screenshot fix 0.4.298 / Build 2026.10.31.528

- Owner screenshots from PENGUIN Production: Quick Order Takeaway bag black; Cashier Q001 paid THB 255 still appears, Kitchen empty, QR issued/open Walk-in tables count 0, Revenue Share THB 255. Specific Q001 Firestore document not read (no gcloud default read token); do not claim actual Kitchen completion, cash/refund or table marker state.
- Root source: IMG bag SVG black, Cashier unconditionally kept all paid Walk-in, Kitchen operational filter omitted paid-status-but-unserved legacy items, QR list correctly shows actual occupied table markers only. Do NOT reconstruct table ownership from sales alone or change THB 255 without payment evidence.
- Branch feature/port-lukkaja-20261031 from release code 0.4.297; updates in react-app/src/pages/QuickOrderPage.jsx (inherit-color Bootstrap bag), CashierPage.jsx, KitchenPage.jsx and new pure data/walkInLifecycle.mjs, plus functions/operational-orders.js legacy paid-but-not-served guard. Completed paid/no-table orders leave Cashier; outstanding paid-first kitchen work remains visible and processable without touching paidAt, paymentStatus or amount. Real occupied table remains actionable through QR; already available table is not fabricated.
- Version 0.4.298, Build 2026.10.31.528 in react-app/src/config/release.js. New 7 lifecycle policy tests PASS; Firebase Auth+Firestore Emulator 2/2 PASS including legacy paid incomplete sequence and no closed-reopen; full React Parity PASS; React Vite generated build contract PASS with index-DS4OlTy0.js. Review exact Git SHA/deploy confirmation in subsequent handoff after release.
- Release sequence for user-accepted ongoing Production bugfix: push this branch, deploy ONLY functions:updateDeferredKitchen in asia-southeast1, then hosting:foodapp. No Firestore Rules update and no other Functions. Verify HTTPS new build and Cloud Function. No live order/financial test writes.

## 2026-10-31 — Firebase release VERIFIED: PENGUIN 0.4.297 / Build 2026.10.31.527

- Owner authorized final UI-focused parity and deploying this exact current branch. Code release HEAD 237ca9a6205287512cb3320f0a0095b4407e52a3 on feature/port-lukkaja-20261031 was built, tested, committed and GitHub-pushed BEFORE the Firebase rollout. Original main and feature/react-firebase-port were not merged or changed. LUKKAJA source read-only.
- Firebase chat-45754 deployed in order: 1) only six target Cloud Functions in asia-southeast1: createWalkInOrder (update), appendUnpaidWalkInItems, settleDeferredWalkIn, cancelDeferredWalkIn, updateDeferredKitchen and cancelReviewedPaidWalkIn (five created); 2) only hosting:foodapp for penguin-food.web.app; 3) only firestore:rules. Each step returned Deploy complete, Rules compiled and released.
- Actual HTTPS smoke: /react/, /cashier/quick-order, /cashier, /kitchen, /admin/sales-report, /reports/revenue-share, /cashier/receipt, and /s/tuahere-somtam/delivery all HTTP 200. New hashed /react/assets/index-BJiEq6aY.js HTTP 200 and public JS explicitly contains 0.4.297, 2026.10.31.527 and LUKKAJA-OCT31-PARALLEL-UI-PARITY. Firebase functions:list confirmed all six functions exist.
- Preproduction automated checks: full React Parity, finance/accounting 9/9, demo-only Firestore/Auth Emulator 2/2 with real transactions and browser rules denial, build/entrypoint contract, browser UI 18/18 and Quick Order button responsive 4/4. No real production payment/order creation, cancellation, provider API or cross-tenant writes attempted.
- Scope limits: Owner requires user-facing UI/UX parallelism, not MySQL/Firestore data equality. No data synchronization. Real signed-in mobile Google Login/Logout, tenant cashier/Kitchen end-to-end, receipt print media 58/80/A4 and all-pixel screens remain owner manual UAT, and protected real PromptPay claims still require provider verification. No certification of pixel-perfect parity beyond tested core changes.
- Firebase CLI warns firebase-functions dependency is older; it was NOT upgraded during this scoped release to avoid breaking unrelated functions. Emulator tests of denied direct Walk-in writes sometimes log legacy Firestore rule evaluation-budget warnings even though negative and positive tests pass; future rule simplification should be isolated.
- Source code remains at release HEAD 237ca9a6205287512cb3320f0a0095b4407e52a3; subsequent docs-only commit records cloud success. No new Version/Build generated after that release.

## 2026-10-31 — Owner-approved release 0.4.297 / 2026.10.31.527 pre-deploy verified

- Owner approved Firebase deploy from existing isolated review branch feature/port-lukkaja-20261031 to project chat-45754, Hosting target foodapp (penguin-food.web.app); version+build bumped in react-app/src/config/release.js.
- Demo-only Firebase Auth/Firestore money/table/role tests 2/2, pure finance/accounting 9/9, React Parity, React build/entrypoint contract, 18 browser UI + 4 Quick Order responsive UI checks all PASS. Scoped Firebase dry-run for ONLY six specified order functions plus firestore:rules plus hosting:foodapp PASS.
- LUKKAJA Kitchen supports reviewed paid cancellation. PENGUIN now supports kitchen actor, no refund, and table release only for a table still owned by the cancelled order. Protected Walk-in Firestore writes are server-only. LUKKAJA source read-only, GitHub original main/react-firebase-port unchanged.
- Intended selective rollout: six Functions FIRST; Hosting SECOND; Firestore Rules LAST. Check actual HTTPS 0.4.297/.527 after publishing. Until cloud success this heading is a pre-deploy record, not a deployment claim.
- Owner specified UI parity only; databases need not be synchronized. No production payment/order data was used for testing, no user mobile login or physical print UAT verified.

## 2026-10-31 — Parallel backup intent: candidate Firebase Walk-in and cancellation, NOT released

- Owner: LUKKAJA (Go/MySQL) and PENGUIN (React/Firebase) are intended as identical business-condition systems and parallel standbys. This does NOT yet mean their live transactions, financial documents, users, stock, or media are replicated between their separate databases.
- Source cosmatch/lukkhaja f9a6ddcd is READ ONLY. Worktree feature/port-lukkaja-20261031 from feature/react-firebase-port d87fc375 is isolated; original main untouched; 24 commit source matrix at docs/LUKKAJA_20261031_PORT_MATRIX.md.
- Implemented candidate: Firebase Functions Cashier/Kitchen role-checked create unpaid cash Walk-in, immutable menu prices for add-on, unique add-operation IDs, serve-first settlement and cash change, atomic table release, kitchen cancelled-item source, unpaid full cancel, paid cashier reviewed void with tenant audit and NO automatic refund. Fixed existing operational error helpers that created HttpsErrors without throwing.
- Firestore Rules block Browser create and update/delete of protected paid/unpaid Walk-ins; other approved orders remain editable. Auth/Firestore demo-only Emulator: transaction + client-rule tests 2/2 PASS. Local policy/accounting suite 9/9 PASS. General React Parity and React Vite candidate build PASS.
- Sales Report shows canceled history separately with original net while excluding cancellations from counted sales, graphs and top items; 5 locale actor labels; receipt red code and -30 degree actor watermark. Prior Delivery Google auth, quick-order visual skin, branded print tab, wallet scroll unchanged.
- NOT COMPLETE: other order types/provider cancellation reconciliation, paid item editing, real browser/physical print UAT, staging, payment provider verification, cross-system data replication and failover drills. Do not merge main or deploy Firebase Hosting/Functions/Rules without separate release approval.
- Use JAVA_HOME=/opt/homebrew/opt/openjdk@21 with Firebase CLI for local Emulator (Java 17 is insufficient); project demo-penguin-lukkaja-parallel only. Existing unrelated test:operational Lalamove contract remains a known baseline failure; no production order writes authorized.

## 2026-10-31 — LUKKAJA to PENGUIN isolated port (not Production)

- User requested porting ALL 24 Oct 31 source commits from LUKKAJA (f9a6ddcd) to PENGUIN. Working branch feature/port-lukkaja-20261031 is based on feature/react-firebase-port d87fc375. Keep main, Production and original local checkout untouched.
- Full commit-by-commit status, completed frontend adaptations and pending Firestore transactional work are in docs/LUKKAJA_20261031_PORT_MATRIX.md. This is only the first port increment.
- New frontend: Delivery Google auth GPS/scroll fixes with Firebase favorites retained; Quick Order green skin/cash select-all/held deletion confirm; wallet/slip spacing; dynamic printed favicon. Tests exist.
- Backend policy stage 2: private pure functions/walkin-finance-policy.js validates cash/deferred eligibility, server-priced cents, idempotent add-on kitchen rounds, served-only settlement, role checks and unpaid cancellations without refunds. tests/react-parity/lukkaja-oct31-deferred-finance-policy.spec.mjs runs as npm run test:lukkaja-walkin-finance-policy. Policy is NOT wired into a Cloud Callable/Firestore writes or UI; transactional APIs, security rules and Emulator still PENDING.
- HIGH PRIORITY PENDING: server-trusted paid cancellation audit + report, kitchen-first deferred unpaid bills, add-on kitchen rounds, cash settlement, table release, role and tenant guards, receipt watermark. Adapt as Cloud Functions/Firestore transactions; use isolated Firebase Emulator only. Do not copy Go/MySQL or enable unsupported payment buttons.
- No main merge, Hosting/Functions deploy, financial writes or version release yet. Owner approval needed separately for production.

## 2026-10-25 — Owner-approved Revenue Share screen preserved; add anniversary-cycle label only

- Owner explicitly requires keeping **exact** existing `/reports/revenue-share` design from penguin-food.web.app screenshots (green hero, period tabs, store/POS + Delivery tiles, threshold progress, equation, Lalamove/Wallet, history and slip upload). Do not replace it with synthetic `/reports/hybrid-billing` or redesign.
- Only markup addition is an unobtrusive billing-period line inside the *existing period filter card*: e.g. **รอบคิดค่าบริการปัจจุบัน: 3/10/2026 - 2/11/2026**. Progress panel reuses that same server-calculated anniversary range; no new cards/CSS/layout. Uses `summary.monthlyDeliveryStartDate` and `summary.monthlyDeliveryEndDate`, not calendar-month inference; missing/invalid range is hidden rather than fabricated.
- Correction to existing text: first 10,000 THB Delivery in each anniversary cycle is EXEMPT; only goods beyond threshold are charged (the previous copy misleadingly said threshold was merely a trigger). Existing business calculation and fee logic untouched.
- Pure formatter + React contract regression tests added. GitHub-first feature commit, safe Mac pull/test. **No Firebase Production deploy**; live web.app screenshots continue to show currently deployed version until explicitly authorized production release.


## 2026-10-25 — Final Github-first local verification, release gate

- **Business code HEAD:** `c4cdca96758382ed1a77d68f946a024eae55d97a`. All changes committed/pushed to `feature/react-firebase-port`, safely `git pull --ff-only` on Mac. No Mac-side uncommitted business code; generated `public/**` files are preserved.
- **Native Mac checks on this HEAD:** `test:hybrid-billing` **353/353 PASS**, `test:react-parity` **PASS** (no failures), `build:react` **PASS** (generated Build Contract PASS), local `node --test tests/firebase-emulator/delivery-share-actual-workflow.spec.mjs` **PASS 1/1** against Auth/Firestore/Storage Emulators. Guarded Functions Emulator safety suite **17/17 PASS**.
- **Local UI smoke:** Vite demo serving `http://127.0.0.1:5174/login` HTTP 200, local owner and Admin callable routes operational and reject unauthenticated calls HTTP 401. Authenticated Premium owner reads `getTenantRevenueShareAccess` and `getTenantRevenueShareSummary` HTTP 200 with anchor **2026-10-03**, daily payable **75 THB**, Delivery **11,500 THB**, share base **1,500 THB**, rate **5%**. The Admin browser screen has NOT been manually signed off.
- **Fixture:** `npm run seed:premium-delivery-demo` PASS, owner `premium-owner@demo.invalid`, Super Admin `premium-reviewer@demo.invalid`, password `EmulatorOnly123!`, sample payable day **2026-10-24**, month **2026-10-03–2026-11-02**. Owner route `/reports/revenue-share`; Super Admin route `/admin/tenants`. In Demo only, a Super Admin clicking review refresh calls `reconcileRevenueShare` to simulate the overdue day; no automatically scheduled cron exported from the Emulator.
- **Release status:** **SOURCE+EMULATOR VERIFIED, OWNER BROWSER UAT PENDING**. Real Slip2Go API keys/bank beneficiary verification have NOT been proven against the live provider; Demo intentionally blocks outbound verification and always queues manual review. Do NOT deploy Production Functions, merge `main`, release real payments, or silently rewrite old paid invoices until owner authorizes a reviewed launch and live provider checks are complete.

## 2026-10-25 — Premium Delivery browser UAT bridge (local-only)

- Last native `tests/firebase-emulator/delivery-share-actual-workflow.spec.mjs` **PASS 1/1** after adding second-day 100 THB strict mocked Slip2Go auto-approval + Firestore claims and release. This is **not a real Slip2Go connection**.
- Previous UAT blocker: `firebase.hybrid-functions-emulator.json` served only private Hybrid callables; live Revenue Share browser page would report `functions/not-found`. Reused guarded `functions/emulator-hybrid/index.cjs` to expose only its required Revenue Share Callables; no Production export or automatic scheduler; manual Super Admin `reconcileRevenueShare` can simulate the overnight action in this local Demo.
- Local browser seeder `npm run seed:premium-delivery-demo` creates a synthetic Premium tenant and Auth owner/Super Admin, monthly cycle from 3 October, first THB 10,000 exempt and yesterday's THB 1,500 excess. It refuses non-local emulator hosts or non-demo project and does not overwrite existing receipts/orders.
- Under the demo-only guard, `inspectRevenueShareSlip` refuses all real bank or Slip2Go traffic and returns `config_required` to queue Super Admin manual review. Production's actual verification behavior is unchanged.
- To test browser: run the guarded existing Hybrid Functions Emulator with `HYBRID_DEMO_FUNCTIONS_ONLY=1` and local hosts, **restart it after updating source**, run `npm run seed:premium-delivery-demo`, run `npm run dev:react:hybrid-demo`, open `/login` then `/reports/revenue-share` and `/admin/tenants`. No Production deploy/merge until Manual UAT and real credential verification prerequisites are satisfied.

## 2026-10-25 — Native Firestore/Auth/Storage Delivery Share UAT

- GitHub-first Commit `6ea258e7` was pulled to Mac and the **real local** Emulator regression (not just an in-memory mock) **PASSED 1/1** at `demo-penguin-hybrid`: 3 October anchor, 10 October 75 THB, 11 October unpaid suspended + inactive slug, duplicate reconcile no-op, synthetic Storage receipt with offline Slip2Go pending, Super Admin verified review approved, restored tenant and slug. No live provider call.
- Added second checked day to that same isolated test: +2,000 THB on 11 Oct implies 100 THB on 12 Oct, strict synthetic signed provider match auto-approves, Firestore global claims created and hold removed without manual review. This is a MOCK of Slip2Go result, NOT genuine online Slip2Go.
- Removed unsafe Premium shortcut: unconditional manual `unlockTenantRevenueShare` now refuses Premium; its correct route is review of a submitted pending proof, not waiver of money owed. Historical emergency override retained for historical Revenue Share.
- **Release gate:** native rerun on GitHub tip, React build + parity and owner live-UI UAT still required. No `main` merge or Production deployment.

## 2026-10-25 — Real local Auth/Firestore/Storage delivery-share workflow acceptance

- Added **emulator-only** acceptance test `tests/firebase-emulator/delivery-share-actual-workflow.spec.mjs`: real Firestore tenant + orders, Auth users, Storage synthetic slip, daily 75 THB invoice calculation; reconciliation sets tenant and slug inactive next day; repeated call idempotent; upload without configured Slip2Go creates **pending** (not paid); Super Admin explicit manual approval clears only revenue-share hold; no real banking/network or production project.
- Guard requires `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST` on loopback and demo project ID. Supports existing local Emulators with explicit env or the new isolated command `npm run test:delivery-share-emulator` (when ports free). The test uses real local Admin Firestore/Auth/Storage SDKs and production Revenue Share implementation with mocked callable wrappers and deliberate **offline** bank provider.
- Fixed Premium emergency Super Admin manual override to load central settings and reject independent subscription suspension. Legacy overrides remain.
- **No Production deploy**: Emulator acceptance result must be recorded after GitHub-first commit and Mac pull.

## 2026-10-25 — GitHub-first Mac sync and final source-test results

- Final business-code HEAD `186437bf872666cee16d0d758a5a81a203c066e4`.
  GitHub-first commits were fast-forward pulled to the Mac while preserving
  54 modified generated `public/**/index.html` files and untracked
  `public/react/**` outputs. No unstaged business-source files remained.
- Native Mac `test:hybrid-billing`: **351/351 PASS**;
  `test:signup-billing-revenue-share`: **18/18 PASS**;
  dedicated Premium daily + suspension/access regression: **8/8 PASS**.
  `npm run test:react-parity`: **PASS, no failures**;
  `npm run build:react`: **PASS, build contract PASS**.
- **Not yet Production release accepted**: these automated checks are NOT a
  complete E2E signed-off staging test of actual Cloud Functions, live Slip2Go
  credentials and store suspension after day end. Production Revenue Share
  scheduler would deactivate real tenants, so **NO production Firebase deploy,
  NO main merge** until an isolated Firestore/Auth/Functions UAT and owner
  sign-off confirms the exact 75 THB flow and recovery. No synthetic bank
  evidence module is required or relevant to this business acceptance.


## 2026-10-25 — Critical cross-scheduler Premium suspension guards

- `react-app/src/app/App.jsx`: Premium Revenue Share suspension now routes owner/admin to payment report, without requiring old billingMode or legacy revenueShareEnabled. Synthetic `hybrid_v1` remains separately guarded.
- `functions/subscription-admin.js`: the separate 00:15 Bangkok subscription scheduler must skip all tenants with revenueShareSuspended=true, even Premium tenants, or it may reopen them before 00:20 billing enforcement; admin subscription updates must not clear the billing hold. Regression contract added.
- This is part of the exact end-to-end business requirement; not a new feature line. GitHub-first commit → safe Mac ff-only pull → test. No Production deploy until UAT.

## 2026-10-25 — GitHub-first Premium Delivery daily workflow integration

- User explicitly directed workflow: develop/commit/push to **GitHub first**, then `pull` to Mac and test; deploy only when complete and accepted. Local branch HEAD matched GitHub `f1d18034` at investigation; only **54 modified `public/**/index.html` and 15 untracked generated `public/react/**` assets** existed locally. They were left untouched, never staged or discarded.
- New GitHub source change: central Premium Delivery percentage uses daily settlement and its historical monthly anniversary threshold; existing Revenue Share scheduler and reconciliation now process Premium too; owner can access payment page while suspended; Slip2Go outages route to Super Admin (no unverified auto-approval), strict beneficiary check, restore after approval while respecting independent holds. Historical legacy settings are unchanged; `hybrid_v1` synthetic ledger remains separately disabled to avoid double billing.
- Added `tests/react-parity/revenue-share-premium-daily-enforcement.spec.mjs` with mocked scheduling/status/payment-review/Slip2Go options, plus existing tests. See `docs/DELIVERY_SHARE_BUSINESS_ACCEPTANCE_20261025.md`.
- **NOT YET ACCEPTED/DEPLOYED**: Do NOT say full production is ready until native full suites+Auth/Firestore Emulator+owner Manual UAT confirm. No main merge, no Firebase Production deploy, no new synthetic financial modules. After passing tests, pull GitHub to Mac without touching/staging generated `public/**`.

## 2026-10-25 — Owner rejected synthetic Phase 10 as incorrect business deliverable

- **IMPORTANT**: Previous Phase 10 Demo "COMPLETE" engineering signoff is NOT the actual requested Delivery commission system. Owner requirement is activation-date monthly cycle (3 Oct to 2 Nov), first 10,000 THB Delivery goods excluded, any excess daily at 5%, pay by that night, suspend next day if unpaid, slip submitted/Slip2Go success or Super Admin manual approval on outage, restore access only when approved.
- Inspected code: `hybrid-billing-core.js` had WRONG formula charging 5% of the 10,000 THB threshold on crossing day, `revenue-share.js` also charged entire qualifying days; fixed both with marginal excess in satang. Native tests: `test:hybrid-billing` **351/351 PASS**, `test:signup-billing-revenue-share` **18/18 PASS**, exact 3 Oct–2 Nov / 11,500 / 75 THB scenario included. Scope in `docs/DELIVERY_SHARE_BUSINESS_ACCEPTANCE_20261025.md`.
- **NOT COMPLETED**: end-to-end Premium/Hybrid daily issuance, real nightly enforcement, verified Slip2Go/manual receipt-to-suspension release in actual live React UI. Hybrid invoice and payment callables remain hard OFF, Premium suspension skipped by historical-only guard, and signup Hybrid disabled. Do not tell owner it is usable/live or claim manual UAT complete.
- Respect dirty generated `public/**` changes. Do NOT reset/clean; do NOT deploy Production, merge main, or activate billing transfers. The correction is only formula and current existing reports. Next objective is ONE authoritative tested owner-facing workflow, not new bank evidence modules.

## 2026-10-25 — Local React UAT bootstrap bug repair (not a new Phase)

- Owner screenshot shows plain `กำลังโหลดข้อมูล...` at `localhost:5174/react/`. Root cause from source: Dev Vite `base:"/react/"` conflicts with `main.jsx` canonical /react -> / redirect; default Vite publicDir also omits repository-hosted `public/assets` and `public/react/parity` used by the shell.
- Fixed **DEV ONLY** `vite.react.config.js` to serve base `/` and repository `public/` directory, retaining build base `/react/` and original build output. Added explicit `dev:react:hybrid-demo` script with both existing emulator flags and strict port, plus native 2-case regression test. See `docs/PHASE10_LOCAL_BROWSER_UAT_20261025.md` for protected 3-terminal Auth/Firestore/Storage/Functions Emulator + demo seeding workflow.
- CRITICAL: plain `npm run dev:react` uses **Production Firebase chat-45754**, even when served from localhost. NEVER perform finance UAT with that mode. Emulator Finance seed records are synthetic; Production settlement is still blocked. No new Phase, no `main` merge/Production deploy. Mac desktop remains offline from ChatGPT; new build and browser UAT require owner Mac execution.

## 2026-10-25 — Phase 10 Demo automated acceptance PASSED (freeze maintained)

- Owner provided two full Mac terminal logs. Native Bank Batch Reservation **10/10**, signed Batch **10/10**, Bank Evidence **10/10**, Hybrid Billing final **350/350**, React Parity tests complete, React Vite build and generated-build contract PASS. After switching JDK 17 to installed **OpenJDK 21.0.13**, real local Auth/Firestore/Storage Emulator **24/24 PASS, exit 0**. Browser `PERMISSION_DENIED` diagnostics are intended negative tests.
- Engineering code for Phase 10 Demo is **COMPLETE and FROZEN**; no further speculative Bank Evidence/Finance phases or features. **Owner manual Demo UAT is not attested in uploaded terminal logs, so formal Demo signoff remains PENDING**. Follow `docs/PHASE10_DEVELOPMENT_CLOSURE_20261025.md`. Do not demand a new automated suite for this document-only status update.
- Last executable code commit: `c1b8b09673d55089de2dfaa999fe5de76febebf5`. Uploaded logs include the reverse-claim Emulator test introduced there, though no explicit `git rev-parse HEAD` line is included.
- Real bank identity, money settlement, and unrelated Lalamove credit/59-baht discrepancies remain **excluded** from Demo closure, unresolved for Production. **NO main merge, NO Firebase deploy, NO bank-transfer release**. Preserve all local generated/modified `public/**` files.

## 2026-10-25 — FINAL Phase 10 scope freeze: stop feature expansion

- Owner requested that Phase 10 **finish**, not spawn an endless series of bank-security demo features. SEE `docs/PHASE10_DEVELOPMENT_CLOSURE_20261025.md` as the single acceptance checklist and scope boundary.
- Fixed the sole known bidirectional DEMO replay gap: `functions/hybrid-billing-refund-candidate.js` now reads `hybridBankBatchReferenceClaims`, `hybridBankBatchInstructionClaims`, and `hybridBankBatchAdjustmentClaims` inside its EXISTING transaction, rejecting any collision; bank batch already checks legacy refund reference/instruction claims. Added unit and real Firestore Emulator reverse-direction tests. No production writer/transfer.
- New status: `CODE-FROZEN / AWAITING HEAD TESTS + OWNER DEMO UAT`, NOT a Production banking signoff. After all acceptance commands pass on this exact HEAD and owner signs off, **mark Phase 10 demo development COMPLETE**. Do not extend it for hypothetical edge cases or external banking integrations. Any new bug is handled as an independently prioritized defect.
- Real bank keys/statements, historical cross-provider payouts and automatic settlement are **not implemented** and are separately blocked external production dependencies. Do not merge `main`, deploy Production or enable Finance transfers without explicit owner release authorization. Preserve local files; Mac may be offline.

## 2026-10-24 — Final Phase 10: DEMO atomic cross-batch bank evidence claims

- User confirmed previous HEAD \`b940b905\` native tests passed and requested continuation. Branch only \`feature/react-firebase-port\`.
- Added PRIVATE \`functions/hybrid-billing-bank-batch-reservation.js\`: refuses non-\`demo-penguin-hybrid\` or non-loopback Emulator, checks active Super Admin in transaction, verifies 1–25 signed synthetic postings using existing batch preflight, then atomically creates 3 globally unique claim types per posting and 1 private batch event. Read old demo refund reference/instruction claims in same TX; duplicate/race/invalid signer fails all-or-nothing. No real bank attestation/payout/release.
- Added 4 deny-all Browser Firestore collections, \`test:hybrid-bank-batch-reservation\` (10 new native unit scenarios) to \`test:hybrid-billing\`, plus real Firestore Emulator collision, concurrency, rollback and Browser denial coverage. Documented in \`docs/HYBRID_PHASE10_BANK_EVIDENCE_CONTRACT_20261024.md\`.
- Key limitations: existing legacy refund candidate writer does NOT yet reciprocally check new bank-batch claims; no cross-channel/historical bank completeness; no real provider authentication; no Production Cloud Functions/settlement. Mac mini offline; new tests NOT run by assistant. Mac should run \`npm run test:hybrid-bank-batch-reservation\`, \`npm run test:hybrid-bank-batch\`, \`npm run test:hybrid-billing\`, \`npm run test:firebase-hybrid-emulator\`, \`npm run test:react-parity\`, \`npm run build:react\`.
- Do not merge \`main\`, deploy Firebase, enable payment flags or money movement without explicit owner approval. Preserve existing local \`public/**/index.html\`; never reset/clean.

## 2026-10-24 — Final Phase 10: private signed bank posting batch preflight

- User confirmed HEAD `4291cf50` native tests passed and requested continuation. Branch only: `feature/react-firebase-port`.
- Added private `functions/hybrid-billing-bank-batch-preflight.js`: verifies 1–100 synthetic signed posting envelopes using existing strict Ed25519/pinned-key verifier, server-derived expected scopes, and within-batch global duplicate bank reference/outgoing instruction/tenant+adjustment detection. Any failure rejects the whole batch. Output redacted counts and diagnostic order-independent SHA-256 only; no Firestore, network, provider API, signer activation or money movement.
- New `test:hybrid-bank-batch` (10 native Node tests, synthetic test keys) included in `test:hybrid-billing`; UAT in `docs/HYBRID_PHASE10_BANK_EVIDENCE_CONTRACT_20261024.md`. Mac mini Remote Desktop remains OFFLINE; native suite has NOT been executed for this new commit by assistant. Run `npm run test:hybrid-bank-batch`, `npm run test:hybrid-bank-evidence`, `npm run test:hybrid-billing`, `npm run test:firebase-hybrid-emulator`, `npm run test:react-parity`, `npm run build:react`.
- Still BLOCKED: real provider signer ownership, authenticated server bank statement ingestion, global historical/cross-batch payout replay control, separate finance settlement receipts/reversals, real App Check/Slip2Go beneficiary UAT, explicit owner release approval. ALL bank trust and settlement flags remain false; no `main` merge/Production deploy. Preserve local `public/**/index.html` and never run reset/clean.

## 2026-10-24 — Final Phase 10: optional owner-pinned offline packet checksum

- Baseline verified on GitHub: `feature/react-firebase-port` at `9e5edbc5`. The existing offline 16-source packet verifier checked only the checksum embedded within the received JSON, which can be recomputed by someone replacing the packet. Do not treat a valid embedded checksum as bank authenticity.
- Added optional `node tools/verify-hybrid-phase10-packet.mjs file.json --expected-sha256=<64-lowercase-hex>`: compare the canonical verified packet checksum to an SHA-256 the owner/reviewer **retained independently at original export**. Wrong pin or malformed option fails with no JSON output; matches return exit status **2 (still BLOCKED)** and `ownerSuppliedChecksumMatched:true`. Without the option, existing one-file usage still works with `ownerSuppliedChecksumMatched:false`.
- Added native-process regression test for a self-consistent substituted packet (new total 13 Phase 10 packet tests), UAT instructions in `docs/HYBRID_PHASE10_UNIFIED_READINESS_20261024.md`; no actual bank authentication, real payouts, settlement, or release allowed.
- Remote Desktop Commander Mac mini remains OFFLINE; **native Node, full Emulator and React build suites NOT run for this change**. Run `npm run test:hybrid-phase10-packet`, `npm run test:hybrid-phase10-readiness`, `npm run test:hybrid-billing`, `npm run test:firebase-hybrid-emulator`, `npm run test:react-parity`, `npm run build:react` on Mac. Preserve local dirty `public/**/index.html`; never reset/clean.
- Remaining real blockers unchanged: independent provider signer ownership, trusted real bank statements and secure ingestion, full historical payout reconciliation, independent settlement receipts and reversals, external App Check/Slip2Go beneficiary UAT and explicit owner approval. No new Phase, `main` merge, Production deploy, flag change or actual money movement.

## 2026-10-24 — FINAL Phase 10: portable unified readiness packet

- User confirmed tests at HEAD `44970a25` passed, requested continuation. Mac mini offline; do not claim new native Node/Emulator runs.
- Added private `functions/hybrid-billing-phase10-review-packet.js` with strict canonical regeneration of all 16-source, redacted FINANCE + BANK KEY tasks and SHA-256 content checksum. Report always `eligibleForBankSettlement:false`, `productionReleaseAllowed:false`, `bankStatementSourceAuthenticated:false`. Verifier rejects modified counts/tasks/unknown fields even if checksum is recalculated. **Checksum is NOT a signature or bank authentication.**
- Extended existing local/demo-only `tools/audit-hybrid-finance-demo.mjs --format=readiness-packet`, preserving existing formats and Emulator/Project/Consent guards before `firebase-admin` import. Added no-network `tools/verify-hybrid-phase10-packet.mjs localfile.json` with max 128 KiB; both commands return exit code **2 even for valid blocked diagnostics**, never green/settled.
- Added `npm run test:hybrid-phase10-packet` (12 new tests; 11/11 V8 mock unit cases passed, 1 native Node file process pending) to `test:hybrid-billing`. Firestore Emulator existing 16-source Readiness integration extended to packet create/verify/tampering. Native Mac/Emulator/build checks still pending for current HEAD.
- New UAT commands documented in `docs/HYBRID_PHASE10_UNIFIED_READINESS_20261024.md`. Finance worklist, old 12-source packet and all previous scripts remain unchanged. No Production export, payment settlement/bank evidence import, release flag activation, main merge or Firebase deploy.
- Remaining Final Phase 10 actual blockers: independently authenticated provider key and real bank statements, historical payouts and finance settlement receipt audit, external App Check/Slip2Go real beneficiary UAT, explicit owner approval. Never assume synthetic/checksum-only bank evidence is real.
- Mac: `git status --short`, `git switch feature/react-firebase-port`, `git pull --ff-only origin feature/react-firebase-port`, `npm run test:hybrid-phase10-packet`, `npm run test:hybrid-phase10-readiness`, `npm run test:hybrid-billing`, `npm run test:firebase-hybrid-emulator`, `npm run test:react-parity`, `npm run build:react`, `git status --short`. Preserve local `public/**/index.html` (never reset/clean).

## 2026-10-24 — FINAL Phase 10: unified 16-source finance & signing-key release blocker report

- User confirmed prior Mac native tests at HEAD `8e71025d` passed. Remote Mac mini offline this turn; new native Node/Emulator React build tests NOT executed.
- Added private `functions/hybrid-billing-phase10-readiness.js` merging sanitized 12-source finance audit/worklist and 4-source bank enrollment history audit; no database writes. Never treats internal Wallet delivery_refund credits as outgoing bank payouts. Both scans are bounded but NON-ATOMIC. All Production/Settlement/Bank trust flags locked false even if no issues.
- Added CLI option `node tools/audit-hybrid-finance-demo.mjs --format=readiness --max=100` with existing demo-ack + exact project + loopback checks before Admin SDK import. Exit code 2 remains expected for unresolved release blockers. Redacted JSON only, no raw IDs, bank references, signers, users or tenant details.
- Added `npm run test:hybrid-phase10-readiness` (12 tests, 12/12 mocked V8 pass) to `test:hybrid-billing`, plus Firestore Emulator integration reading all 16 sources and ensuring no release. Native Mac/Emulator tests pending for this commit.
- Docs: `docs/HYBRID_PHASE10_UNIFIED_READINESS_20261024.md`. No new phases, `main` merge, Firebase Production deployment, key activation, settlement transfer or release-flag modifications.
- Safe Mac: `git status --short`; `git switch feature/react-firebase-port`; `git pull --ff-only origin feature/react-firebase-port`; `npm run test:hybrid-phase10-readiness`; `npm run test:hybrid-billing`; `npm run test:firebase-hybrid-emulator`; `npm run test:react-parity`; `npm run build:react`; `git status --short`. Do not reset/clean dirty `public/**/index.html`.
- Final Phase 10 remains BLOCKED for authenticated bank/provider identity, full historical payout coverage, independent real finance settlement authorization, App Check/Slip2Go UAT and explicit owner release decision.

## 2026-10-24 — FINAL Phase 10: four-collection private bank key enrollment integrity history

- User confirmed native Mac suite for previous HEAD `dec33889` passed; Remote Desktop Commander Mac mini still OFFLINE during new work, so new native Node/Emulator test results not yet confirmed.
- Added read-only private `functions/hybrid-billing-bank-key-history-audit.js`: exact `demo-penguin-hybrid`, local Firestore Emulator only, bounded scans of four global collections (requests, reviews, fingerprint claims, key-slot claims), max 500 docs/source with explicit limit-overflow exception. No Production import, web/Firestore writer, payout or key activation. Scans are deliberately NON-ATOMIC.
- Audit cross-checks request schema and states, global SHA256 fingerprint + provider/key-slot hash and backrefs, review actor separation, decision/status and timestamps; flags orphaned/missing/spoofed documents. Pending reviews are counted separately (pending is expected, not itself an integrity anomaly). Returns ONLY aggregate counts, allowlisted issue codes and release blockers: never raw fingerprints, UIDs, IDs or PEM.
- Report permanently states `bankOriginAuthenticated:false`, `trustedRegistryPromoted:false`, `anyKeyActivated:false`, `historicalKeyCoverageVerified:false`, `settlementAllowed:false`, `releaseReady:false`. Consistent/empty Firestore is NOT real bank trust.
- New `npm run test:hybrid-bank-key-history` included in `test:hybrid-billing`; 14/14 source-level mocked V8 test cases passed. Added actual Emulator integration scenario verifying orphan claim detection, redaction, bounded overflow and disabled bank trust; native Emulator not yet run.
- Docs updated in `docs/HYBRID_PHASE10_BANK_KEY_ENROLLMENT_20261024.md` and `docs/HYBRID_PHASE10_BROWSER_EMULATOR_UAT_20261024.md`. No `main` merge, Production deployment or release flag alteration. Preserve local dirty `public/**/index.html` on Mac.
- Continue Phase 10 only: independently authenticate real bank public key ownership and trusted provider onboarding, authenticated statement import, historical payout migration, independent finance final settlement and App Check/Slip2Go UAT. Do not infer actual bank trust from these demo diagnostics.
- Safe Mac: `git status --short`; `git switch feature/react-firebase-port`; `git pull --ff-only origin feature/react-firebase-port`; `npm run test:hybrid-bank-key-history`; `npm run test:hybrid-bank-enrollment`; `npm run test:hybrid-billing`; `npm run test:firebase-hybrid-emulator`; `npm run test:react-parity`; `npm run build:react`. Never `git reset --hard` or `git clean`.

## 2026-10-24 — Final Phase 10: revalidate global bank signer claims at review

- User confirmed native Mac tests at previous HEAD `e079da63` passed and requested continuation. Remote Mac remains OFFLINE in this turn; new native tests have NOT been run by assistant.
- Hardened private `functions/hybrid-billing-bank-key-enrollment.js`: exact top-level input shape (reject caller-injected PEM, bank origin, activation flags) for both stage/review; review rechecks exact immutable request metadata and validity, current two active Super Admin identities, fingerprint and provider/key slot Global Claims, and prior event in ONE transaction; any missing, spoofed or cross-request claim denies review.
- Updated `tests/react-parity/hybrid-bank-key-enrollment.spec.mjs` from 6 to **11** scenarios (11/11 V8 mocked pass) including tamper, absent claims, time expiry, unexpected input and simultaneous reviewers. Added real Firestore Emulator concurrency and claim-tamper tests in `tests/firebase-emulator/hybrid-finance-security.spec.mjs`. Native Mac/Emulator results pending for this new HEAD.
- All outputs remain `bankOriginAuthenticated:false`, `trustedRegistryPromoted:false`, `keyActivated:false`; no bank key activation, trust-root onboarding, payout, settlement or Production Callable.
- Full notes and UAT in `docs/HYBRID_PHASE10_BANK_KEY_ENROLLMENT_20261024.md` and `docs/HYBRID_PHASE10_BROWSER_EMULATOR_UAT_20261024.md`.
- Do not modify/main merge/Production deploy until explicit owner approval. Mac safe commands: `git status --short`, `git switch feature/react-firebase-port`, `git pull --ff-only origin feature/react-firebase-port`, `npm run test:hybrid-bank-enrollment`, `npm run test:hybrid-bank-key-policy`, `npm run test:hybrid-bank-evidence`, `npm run test:hybrid-billing`, `npm run test:firebase-hybrid-emulator`, `npm run test:react-parity`, `npm run build:react`. Never reset/clean existing local `public/**/index.html`.

## 2026-10-24 — Final Phase 10: private demo bank signer enrollment audit

- User confirmed native Mac tests through `97248355` passed. Remote Desktop Commander Mac mini OFFLINE this turn. New commits NOT yet run with native Node or Emulator.
- Added `functions/hybrid-billing-bank-key-enrollment.js` Demo-only (`BANK_KEY_ENROLLMENT_PRODUCTION_READY=false`, exact `demo-penguin-hybrid` project and loopback Emulator host). Two private Admin transactions: immutable key metadata request + atomic global fingerprint and provider/key slot claims; immutable review by a second currently active Super Admin (revalidates proposer), or reject. No public/private signing keys, PEM, banking credentials or raw accounts stored.
- ALL results retain `bankOriginAuthenticated:false`, `trustedRegistryPromoted:false`, `keyActivated:false`. Review state `internally_acknowledged_untrusted` is NOT bank key authenticity; no trustedRegistry change, no payment/settlement/Wallet/tenant writes, no Production callable.
- Added explicit deny-all Browser Firestore Rules for four global collections and tests: `test:hybrid-bank-enrollment` (6 mocked V8 source fixtures PASSED) in `test:hybrid-billing`; true Admin Firestore Emulator staging/reviewer/duplicate and every Browser role GET/LIST/WRITE denial test (native run pending).
- Detailed UAT `docs/HYBRID_PHASE10_BANK_KEY_ENROLLMENT_20261024.md`; updated Bank Evidence Contract and hybrid Browser Emulator UAT. Full bank/provider authentication remains unimplemented and must not be inferred from internal review.
- Continue Phase 10 only, no main merge, Production deploy, flag activation or real financial movement. Mac safe run: check clean working tree and fast-forward only, `npm run test:hybrid-bank-enrollment`, `npm run test:hybrid-bank-key-policy`, `npm run test:hybrid-bank-evidence`, `npm run test:hybrid-billing`, `npm run test:firebase-hybrid-emulator`, `npm run test:react-parity`, `npm run build:react`. Preserve dirty `public/**/index.html`.

## 2026-10-24 — FINAL Phase 10: pinned dual-control Ed25519 key lifecycle

- User confirmed native Mac suite of previous HEAD `0e245e4a` PASSED and asked to continue. Mac mini Remote Desktop Commander remains OFFLINE this turn; do NOT claim new native Node/Emulator results.
- New PRIVATE `functions/hybrid-billing-bank-key-policy.js`, used by existing `functions/hybrid-billing-bank-evidence-contract.js`. Every server-supplied signer requires SPKI DER SHA256 pinned fingerprint, active UTC time window covering posting & verification, `revokedAt:null`, `enabled:true`, independent internal `registeredBy`/`reviewedBy`, exact field allowlist and own-property provider/key matching to prevent prototype inheritance. Reject forged keys, revoked/expired keys, unapproved self-review and unknown rotation. **This remains a synthetic trust-roster policy, NOT verified bank identity.**
- Updated prior `tests/react-parity/hybrid-bank-evidence-contract.spec.mjs` setup to complete pinned test-key registry and new error names. Added `tests/react-parity/hybrid-bank-key-policy.spec.mjs` with 11 scenarios + npm `test:hybrid-bank-key-policy` included in `test:hybrid-billing`. V8 fake-crypto policy scenarios **11/11 PASS**, not equivalent to native cryptographic tests.
- No real bank key onboarding, bank API, claims/settlement changes, Production callable, bank transfer, new release flag or main merge. Existing `bankProviderIdentityIndependentlyAuthenticated:false`, `settlementAllowed:false`, `realBankStatementSourceIntegrated:false` still locked.
- Updated bank evidence contract & UAT docs. Next meaningful prerequisite: independent bank/provider public-key ownership/onboarding and credentials via server Secret Manager, signed statement ingestion, complete historical bank payouts, final independent finance settlement authorization and append-only receipts, then App Check/Slip2Go UAT and explicit user go-live signoff.
- Mac safe fast-forward commands: `git status --short`, `git switch feature/react-firebase-port`, `git pull --ff-only origin feature/react-firebase-port`; then `npm run test:hybrid-bank-key-policy`, `npm run test:hybrid-bank-evidence`, `npm run test:hybrid-billing`, `npm run test:firebase-hybrid-emulator`, `npm run test:react-parity`, `npm run build:react`. Do NOT reset/clean dirty generated `public/**/index.html`.

## 2026-10-24 — Final Phase 10: Ed25519 bank evidence format/safety preflight

- User confirmed Mac native suite at prior HEAD `c35ede46` passed, asked to continue. Mac mini Remote Desktop Commander is OFFLINE, so **new Ed25519 native Node tests are not yet confirmed**.
- New PRIVATE `functions/hybrid-billing-bank-evidence-contract.js`: strict Ed25519 detached signature/format check against externally supplied **server-controlled** public key registry; canonical payload binds tenant+invoice+adjustment+amount in satang+hashed outgoing instruction+bank reference+recipient+posted debit THB time. Rejects unknown/revoked keys, wrong provider, extra fields, non-UTC, pending/wrong direction/currency and mismatches; no raw transfer or credentials in result.
- IMPORTANT: no live provider key/credential/integration. A successfully verified synthetic signature is **NOT** authenticated banking provenance. All returned flags permanently `bankProviderIdentityIndependentlyAuthenticated:false`, `realBankStatementSourceIntegrated:false`, `settlementAllowed:false`, `releaseReady:false`; no DB writes/Cloud Function/real payout or unlock. Synthetic `trusted_bank_statement` source strings remain untrusted, and candidate writer is still demo-only.
- Added `tests/react-parity/hybrid-bank-evidence-contract.spec.mjs` (10 cases) as `test:hybrid-bank-evidence` and to `test:hybrid-billing`; Ed25519 keys are generated only at test runtime. V8 with mocked crypto passed **6/6** format/guard smoke checks; REAL Ed25519 Node tests and Emulator/build still pending native Mac.
- Docs in `docs/HYBRID_PHASE10_BANK_EVIDENCE_CONTRACT_20261024.md`. No Production flags on, no `main` merge or Firebase deploy.
- Next: true bank/provider public-key onboarding verified independently, secure server ingress, authenticated bank transaction import, historical cross-channel payout manifest, idempotent settlement+receipts under finance controls, App Check/Slip2Go UAT and explicit production permission.
- Mac safe run: `git status --short`; `git switch feature/react-firebase-port`; `git pull --ff-only origin feature/react-firebase-port`; `npm run test:hybrid-bank-evidence`; `npm run test:hybrid-billing`; `npm run test:firebase-hybrid-emulator`; `npm run test:react-parity`; `npm run build:react`. Preserve dirty generated `public/**/index.html`.

## 2026-10-24 — FINAL Phase 10: offline finance review packet, checksum-only

- User confirmed native Mac tests at previous HEAD `952f2681` passed, asked to proceed. Remote Mac mini remained OFFLINE; native tests for NEW commits in this turn are not yet verified.
- Added pure PRIVATE `functions/hybrid-billing-finance-review-packet.js`: canonical allowlisted finance Worklist packet from existing demo inventory only. SHA256 domain-separated content checksum, generation UTC, fixed `demo-penguin-hybrid`, clear `digitallySigned:false`, `bankSourceAuthenticated:false`, `settlementAllowed:false`, `releaseReady:false`, `checksumIsBankAttestation:false`. Validator rebuilds canonical Thai finance task catalog, checks exact source counts and mandatory release blockers, detects body/checksum changes and rejects forged bank/payment flags. **Checksum is NOT signer or bank authenticity**; must retain original checksum separately. No real money or Settlement.
- Extended DEV-only `tools/audit-hybrid-finance-demo.mjs --format=packet`, validated local emulator/explicit ACK before Admin SDK import, exits **2 expected** even on successful export. Added fully-offline `tools/verify-hybrid-finance-packet.mjs file.json`, capped at 128 KiB, prints sanitized integrity-only result, exits **2 on checksum consistency**, non-2 on invalid file. No network/Bank/Firestore writes from verifier.
- Added `test:hybrid-finance-packet` to `test:hybrid-billing` with 11 cases (10 source-level V8 passed; 1 requires native Node spawn/file I/O); Firestore Emulator financial audit test now exercises packet assembly and rejection on modified counts. Native Node Emulator test pending on Mac.
- Documented exact isolated CLI/verification commands and limitations at `docs/HYBRID_PHASE10_FINANCE_REVIEW_PACKET_20261024.md`. No Production Callable, no Release flags, no `main` merge, no Firebase deploy.
- Next: authentic external bank statement and historical payouts from trusted providers, independent settlement approval and idempotent receipts, App Check/Slip2Go go-live conditions. No new Phase number/subphase.
- Mac: `git status --short`, `git switch feature/react-firebase-port`, `git pull --ff-only origin feature/react-firebase-port`, `npm run test:hybrid-finance-packet`, `npm run test:hybrid-finance-worklist`, `npm run test:hybrid-billing`, `npm run test:firebase-hybrid-emulator`, `npm run test:react-parity`, `npm run build:react`. Preserve existing local `public/**/index.html`.

## 2026-10-24 — Final Phase 10: finance exception Worklist + local Emulator report CLI

- User confirmed previous Mac tests for HEAD `e8c8798f` passed and asked to continue. Mac mini Remote Desktop Commander is still OFFLINE; new native tests have not been rerun.
- Added private pure `functions/hybrid-billing-finance-worklist.js` that maps 12-source sanitized finance integrity audit into prioritized Thai/English FINANCE TASKS. The four external bank and completeness blockers ALWAYS remain, even with zero documents. Unknown issue strings are never echoed (generic unknown code instead); totals are allowlisted. No raw bank, invoice, slip, tenant, reviewer or instruction data emitted.
- Added `tools/audit-hybrid-finance-demo.mjs` CLI. Explicit `HYBRID_FINANCE_AUDIT_DEMO_ACK=1`, exact `GCLOUD_PROJECT=demo-penguin-hybrid`, and local `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` are validated BEFORE Admin SDK import. Prints safe Thai text or JSON. Exit status **2 expected** (blocked for actual bank settlement). Database is READ-ONLY and production is never queried. Script: `npm run audit:hybrid-finance-demo` or direct `node tools/audit-hybrid-finance-demo.mjs --format=text --max=100` with environment variables.
- Added `tests/react-parity/hybrid-finance-worklist.spec.mjs` (11 tests) into `test:hybrid-billing`. Source-level V8 harness **9/9 non-process tests PASS**; 2 CLI spawned-Node tests need native Mac run. Real Firestore Emulator security test now maps the audited history into a safely redacted Worklist and verifies missing per-invoice reserved balance produces a finance exception; not rerun natively this turn.
- Docs updated: `docs/HYBRID_PHASE10_FINANCE_HISTORY_AUDIT_20261024.md` contains exact isolated Emulator commands, JSON redirection, limitations and expected exit code; `docs/HYBRID_PHASE10_BROWSER_EMULATOR_UAT_20261024.md` contains acceptance steps.
- No Production callable, bank integration, payout, settlement, wallet, release flags or `main` merge changed. Live refund validation still blocked pending authenticated bank source + complete historical payout manifest + independent Finance settlement authorization and owner go-live approval.
- Safe Mac: `git status --short`, `git switch feature/react-firebase-port`, `git pull --ff-only origin feature/react-firebase-port`; then `npm run test:hybrid-finance-worklist`, `npm run test:hybrid-refund-history`, `npm run test:hybrid-billing`, `npm run test:firebase-hybrid-emulator`, `npm run test:react-parity`, `npm run build:react`. Never hard-reset or clean local generated `public/**/index.html`.

## 2026-10-24 — FINAL Phase 10: full immutable finance adjustment chain audit

- User confirmed previous Mac test suite at `4eaab302` passed and requested continuation. Remote Mac mini remains OFFLINE; new commits have NOT received a native Mac/Emulator verification yet.
- Enhanced PRIVATE demo-only `functions/hybrid-billing-refund-history-audit.js` from 9 to **12** source collections: added `hybridBillingInvoices`, `hybridBillingAdjustmentEvents` and `hybridBillingAdjustmentBalances`.
- Diagnostic now cross-checks original PAID immutable invoice signature, refund adjustment status/amount, reviewer event, distinct three finance actors, per-invoice reserved amount/count, global reference/instruction claims and candidate identity. Missing/forged/orphaned records create `integrityIssueCodes` and public-safe `blockers` (no IDs, bank refs or slips).
- The tool remains hard-limited to local `demo-penguin-hybrid` Emulator, 500 documents/source max, no Firestore writes and **ALWAYS returns `settlementAllowed:false`, `releaseReady:false`, `bankSourceAuthenticated:false`, `historicalBankCoverageVerified:false`**. A self-consistent Firestore history does not prove external bank payout history.
- `tests/react-parity/hybrid-refund-history-audit.spec.mjs` extended from 11 to 16 cases: **16/16 V8 source/mock tests passed**. New actual Firestore Emulator fixture asserts missing Adjustment Balance is reported rather than silently approved; native Emulator not yet run on this turn.
- Updated UAT, decision matrix and handoff in `docs/HYBRID_PHASE10_FINANCE_HISTORY_AUDIT_20261024.md`. Do not merge main, deploy Production, move cash or turn on the release flags.
- Next: trusted authenticated bank import + independently signed historical/legacy payout manifest, immutable settlement attestation and idempotent anti-replay receipts (not yet implemented), then App Check / Slip2Go bank UAT and explicit go-live approval.
- Mac safe commands: `git status --short`, `git switch feature/react-firebase-port`, `git pull --ff-only origin feature/react-firebase-port`, `npm run test:hybrid-refund-history`, `npm run test:hybrid-billing`, `npm run test:firebase-hybrid-emulator`, `npm run test:react-parity`, `npm run build:react`. Never hard-reset/clean local `public/**/index.html`.

## 2026-10-24 — FINAL Phase 10: read-only historical cross-channel finance inventory

- User confirmed native Mac tests through `9b3e9960` passed and asked to proceed. Mac mini Remote Desktop Commander remains OFFLINE: tests on **new** commits from this response have not been natively rerun.
- Added `functions/hybrid-billing-refund-history-audit.js`: PRIVATE, demo-only (exact `demo-penguin-hybrid` + localhost Emulator) bounded Admin read across 9 real finance/claim collections. Read-only, no invoice/refund/Wallet/tenant writes. Cross-checks global reference/instruction claims against tenant candidates; outputs only aggregate counts and issue-code blockers, no raw identifiers, accounts or slips. Cap 1–500 docs/source, fail closed on overflow.
- Wallet `delivery_refund` CREDIT is NOT an actual outward bank transfer. Incoming Wallet Topups, revenue share and hybrid invoice proof claims are distinct and cannot be hashed/equated blindly with outgoing bank refunds.
- Report ALWAYS returns `releaseReady:false`, `settlementAllowed:false`, `historicalBankCoverageVerified:false`, `bankSourceAuthenticated:false`, `atomicSnapshot:false`; collections being internally consistent does not prove bank payout history. Backfilled historical manifest, verified external source integration and finance attestation are required before future settlement writer.
- `test:hybrid-refund-history` added to `test:hybrid-billing` with **11/11 source-level V8 tests PASS**, not native Node. Real Firestore Emulator negative/overflow case added to `hybrid-finance-security.spec.mjs`, not yet run on user's Mac.
- Documentation `docs/HYBRID_PHASE10_FINANCE_HISTORY_AUDIT_20261024.md`. No Production export/flags change, no `main` merge, no Firebase deploy or money movement. Preserve dirty generated local `public/**/index.html`.
- Recommended Mac: inspect `git status --short`, `git switch feature/react-firebase-port`, `git pull --ff-only origin feature/react-firebase-port`, `npm run test:hybrid-refund-history`, `npm run test:hybrid-billing`, `npm run test:firebase-hybrid-emulator`, `npm run test:react-parity`, `npm run build:react`.

## 2026-10-24 — FINAL Phase 10: refund instruction anti-replay + read-only evidence UI

- User confirmed native Mac tests on prior HEAD `a442f1ce` passed and asked to continue. Remote Mac mini remains OFFLINE; **new code here has not been run with native Node/Emulator/Build yet**.
- Private DEV-only refund candidate transaction now locks BOTH global identifiers atomically: `hybridRefundReferenceClaims/{bankReferenceHash}` and `hybridRefundInstructionClaims/{sha256("hybrid-refund-instruction-v1:" + instructionId)}`. No raw instruction ID in a candidate or claim; both claim collections are inaccessible to EVERY Browser role. Same instruction under a different bank reference can no longer be reused; reverse also true.
- Added a second real Firestore Emulator concurrency race, using the same instruction ID but different tenant/reference, plus Browser deny-get/list/write tests for global instruction claims. `test:hybrid-refund-candidate` now 9 cases, direct V8 mocked transactions **9/9 PASS**, Emulator **not yet run this turn**.
- Super Admin `/platform/hybrid-invoices` adds a read-only paginated `hybridBillingRefundCandidates` table. Shows only adjustment ID, original invoice ID, amount, date, observer, and **Bank attestation pending / Payout not confirmed**. Browser adapter **ignores stored `settlementConfirmed`, `sourceIntegrationReady`** even if corrupt, never sends raw bank refs, destination fingerprints, instruction IDs or statements to the component. Tenant+refresh scoping and duplicate-page prevention reused.
- Fixed an existing UI bug: bank-account numeric redaction was also masking the YYYY-MM-DD part of Invoice IDs. `safeFinanceId` now validates allowed identifier characters without masking ledger IDs; `safeFinanceText` continues masking account-like numbers in free-form finance notes. Source UI static and fake Firebase-data tests **15/15 PASS**.
- Added `test:hybrid-refund-ui` (4 cases) and included in `test:hybrid-billing`. Updated Firestore Rules and Emulator/browser role deny scenarios.
- **NOT solved**: no authenticated live bank statement/provider import; new claim tables do not prove historical/legacy or cross-channel (Wallet/revenue share) completeness. The existing `financeSlipClaims` bank hashes use a different input/domain and pertain to incoming slips, so never equate them blindly to outgoing-refund SHA256 IDs. Before production settlement, perform full-direction-appropriate ledger reconciliation + historical migration and define authenticated source/settlement attestation. Production flags all OFF; no deploy or main merge.
- Mac after safe `git status` + `git pull --ff-only`: `npm run test:hybrid-refund-candidate`, `npm run test:hybrid-refund-ui`, `npm run test:hybrid-billing`, `npm run test:firebase-hybrid-emulator`, `npm run test:react-parity`, `npm run build:react`. Preserve local `public/**/index.html`.

## 2026-10-24 — FINAL Phase 10: demo refund evidence anti-replay, no settlement

- User confirmed previous Mac test suite `805009b3` passed and asked to continue; Mac mini Remote Desktop Commander is OFFLINE this turn. **New commits' native tests/Emulator not confirmed**.
- Added PRIVATE `functions/hybrid-billing-refund-candidate.js` implementing `recordDemoHybridRefundCandidate`, with hard `HYBRID_REFUND_CANDIDATE_PRODUCTION_READY=false` and verified local Firestore Emulator + exact `demo-penguin-hybrid` project. Not imported by Production bootstrap.
- The 3rd active Super Admin (neither proposer nor reviewer) rechecks paid invoice, approved adjustment, immutable decision event, and source compare in one Admin transaction; creates server-private global `hybridRefundReferenceClaims/{hash}` and immutable tenant-scoped `hybridBillingRefundCandidates/{adjustmentId}`. Concurrent/replayed/hash-reused candidates reject, including cross-tenant. No bank source is presently authenticated; candidate remains `awaiting_independent_bank_attestation`, `settlementConfirmed:false`, `sourceIntegrationReady:false`, no invoice status changes, cash payout, Wallet or tenant access changes.
- Firestore Rules deny every Browser role reads/writes on global claims; candidate is Super Admin read-only; all client writes denied. Added `test:hybrid-refund-candidate` (8 cases) and real Firestore Emulator cross-tenant race/permissions test to `hybrid-finance-security.spec.mjs`. **8/8 V8 unit fixture tests passed**, but real Mac/Emulator tests pending for this update.
- Full instructions and limitations in `docs/HYBRID_PHASE10_REFUND_CANDIDATE_20261024.md`. Before the user signs off on go-live, need authentic bank import, old refund reconciliation, global cross-channel claims, independent final finance attestation and settlement receipt, App Check/Slip2Go and Browser UAT. Keep Production flags OFF; no merge/main or Production deployment.

## 2026-10-24 — FINAL Phase 10: adjustment history UI and private refund bank reconciliation preflight

- User confirmed native tests for `49597547` passed and requested continuation. Mac mini Remote Desktop Commander is OFFLINE during this session; **native tests on new commits are not yet confirmed**.
- Super Admin `/platform/hybrid-invoices`: added TWO read-only paginated tenant-scoped lists — `hybridBillingAdjustments` (proposed/approved/rejected) and immutable `hybridBillingAdjustmentEvents`. Each page is scoped to the current selected tenant + revision, deduplicates rows, disallows simultaneous paging, and masks account-like numbers. UI labels `approved` strictly as **INTERNAL approval only**; regardless of a malformed `externallySettled` field, the adapter never surfaces a bank payout confirmation. No upload, finance mutation, payout or browser finance callable added.
- Added `tests/react-parity/hybrid-adjustment-review-ui.spec.mjs` 5 data/permission/status test cases, plus additions to `hybrid-invoice-review-ui.spec.mjs`. V8 source harness: 10/10 existing+new UI static tests and 5/5 new fake-Firestore data tests PASS (not native tests).
- Added `functions/hybrid-billing-refund-reconciliation.js`, PRIVATE pure preflight `planHybridRefundReconciliation` for refund requests ONLY (not credit notes or chargeback), requiring original immutable PAID invoice, approved adjustment, independent reviewer event, exact amounts in satang/THB, two independent *future trusted* sources: outgoing disbursement and posted debit on bank statement, same SHA256 transfer reference and beneficiary fingerprint, chronological posting, no historically claimed bank hash. Returns `candidate_for_independent_finance_attestation` plus `settlementConfirmed:false`, `bankSourceIntegrationReady:false`, `writesPerformed:false` — NEVER a payout or settlement.
- `tests/react-parity/hybrid-refund-reconciliation.spec.mjs` adds 8 cases for amount/currency/destination/ref hash, cross-tenant, fraudulent/duplicate/time order and no bank writes. V8 harness 8/8 PASS (not Native Node/Emulator). Scripts `test:hybrid-adjustment-ui`, `test:hybrid-refund-reconciliation` are included in `test:hybrid-billing`.
- Remaining: real trusted bank/provider import and verified outgoing transfer attestation, idempotent global bank reference transaction, actual settled document transition/receipt, UI authorised initiation + refund destination policy, real App Check/Slip2Go bank setup, historical migration, recovery policy, browser/UAT, explicit owner approval. All Production payment gates remain OFF; no main merge/deploy.
- Safe Mac commands after checking clean state and fast-forward only: `npm run test:hybrid-adjustment-ui`, `npm run test:hybrid-refund-reconciliation`, `npm run test:hybrid-billing`, `npm run test:react-parity`, `npm run build:react`. Preserve dirty generated `public/**/index.html`.

## 2026-10-24 — FINAL Phase 10: atomic adjustment proposal & four-eyes finance review (not payout)

- Owner confirmed Mac suite at `65cde0e6` passed and asked to continue. Mac mini Remote Desktop Commander is still **OFFLINE**, so the new code and tests from this turn have not been run with native Node/Emulators/React Build.
- Created private server module `functions/hybrid-billing-finance-records.js`, **NOT exported by Production bootstrap**. `recordHybridAdjustmentProposal` authenticates a currently active Super Admin inside a Firestore transaction, rechecks the tenant and original immutable invoice, calls the pure finance policy and atomically creates one `hybridBillingAdjustments/{adjustmentId}` plus an authoritative per-invoice `hybridBillingAdjustmentBalances/{invoiceId}` cap. Concurrent proposals for the same invoice serialize on the cap document.
- `reviewHybridAdjustmentProposal` requires a different active Super Admin to approve or reject, rechecks original invoice signature, status and reserved amount in the same transaction, creates immutable `hybridBillingAdjustmentEvents/{adjustmentId}-review` and updates only the adjustment status; reject releases the reserved cap, approve keeps it. There is **no settlement/real refund, Wallet credit, tenant unlock or invoice paid-state change**, even when a proposal is `approved`.
- Firestore Rules: `hybridBillingAdjustments` and `hybridBillingAdjustmentEvents` are READ ONLY to active Super Admin; clients of any role cannot create/update/delete; `hybridBillingAdjustmentBalances` is fully server-private. Added browser-role Firestore emulator negative tests. Added real Emulator concurrent 350+350 vs invoice 500 assertion, reviewer self-approval/demotion, reject release cap and audit replay denial.
- `test:hybrid-finance-records` added (9 new unit cases) and included in `test:hybrid-billing`; direct V8 source mock transaction run **9/9 passed**. Not equivalent to real Firebase Emulator tests.
- Continue after testing: actual external bank payout reconciliation and receipts, sanitised financial adjustment UI and migration/legacy reference controls, App Check/real Slip2Go beneficiary acceptance, historical hold recovery with trusted up-to-date snapshot transaction, approved access policy, owner Production signoff. Phase 10 remains FINAL; no numbered subphases. All Production release flags stay FALSE; do not deploy or merge `main`.
- Mac safe run: inspect `git status --short`, `git switch feature/react-firebase-port`, `git pull --ff-only` if no local conflict; `npm run test:hybrid-finance-records`, `npm run test:hybrid-billing`, `npm run test:firebase-hybrid-emulator`, `npm run test:react-parity`, `npm run build:react`. Preserve local generated `public/**/index.html`.

## 2026-10-24 — FINAL Phase 10: refund/credit/recovery safety (new native Mac tests pending)

- Owner confirmed native Mac test suite for `11274844` passed and asked to continue. Remote Mac mini remains OFFLINE; code in this update has **not** run native Mac Emulator or React Build yet.
- Added `functions/hybrid-billing-finance-policy.js` (PRIVATE PURE DRY-RUN): `planHybridAccessRecovery` inspects paid vs issued/rejected/pending invoices, exact next-day suspend rule, THB satang, duplicate tenant/invoice/signature and old-period debt, and cannot propose releasing a Hybrid hold unless `coverageVerified: true`. Patches include ONLY `hybridBillingSuspended`; NEVER active, subscription, legacy holds, wallet or payment.
- Added `prepareHybridAdjustmentProposal` to validate compensation candidates credit_note (unpaid invoice), refund_request and chargeback_review (paid invoice), reason, immutable invoice signature, uniqueness, trusted tenant scope and over-adjustment cap. Outputs `status: proposed`, `writesPerformed: false` and requires finance approval/real payout when appropriate. **No money has been moved and no invoice changed.** Rejected proposals don't count toward cap, approved/settled candidates do. Manual finance handling and actual adjustment settlement still pending.
- Added private `functions/hybrid-billing-recovery-reader.js` to prove complete historical coverage: scans all activation anniversary periods since anchor (max 120), requires valid locked period index and queries up to 4001 invoices in a bounded read, cross-checks exact index equality before invoking policy with verified coverage. Missing index, unindexed invoice, duplicate, excessive history or changed period => **fail closed**; no Firestore writes.
- Hardened `react-app/src/auth/tenantAccess.js`: manual/security/legacy holds outrank Hybrid owner/admin billing-only exception. Ordinary active:false without explicit manual reason during Hybrid hold preserves pre-existing billing-only access; separate `suspensionReason` blocks.
- Added scripts `test:hybrid-finance-policy` (10 cases) and `test:hybrid-recovery-reader` (5 cases) to `test:hybrid-billing`, plus access regressions in `hybrid-billing-report.spec.mjs`. Source-level V8 harness executed **15/15 new tests PASS**, including dry-run safety; not native Node.
- These are *review/decision prerequisites*, not a live adjustment writer or automatic tenant unlock. Deployment guard flags and production endpoints stay OFF. Preserve dirty local `public/**/index.html`.
- Mac commands after safe fast-forward: `npm run test:hybrid-finance-policy`, `npm run test:hybrid-recovery-reader`, `npm run test:hybrid-billing`, `npm run test:react-parity`, `npm run build:react`. Later run full Emulator and browser UAT.
- Go-live remains blocked by bank recipient ownership confirmation, real Slip2Go/App Check verification, manually approved payout/refund/chargeback processes, trusted transaction writer with stale-data protection and finance audit, guaranteed period coverage/migration for legacy tenants, and explicit owner Production approval. Continue all within FINAL Phase 10; never add a new subphase.

## 2026-10-24 — FINAL Phase 10: Strict Hybrid Slip2Go beneficiary and HTTP provenance

- User confirmed preceding Mac tests on HEAD `c9c0b319` passed and approved continuation. Mac mini connector still OFFLINE; **changes after this HEAD have not been natively tested**.
- Reconciled a critical go-live gap: shared `functions/slip-verification.js` previously allowed receiver config with only a name or only an account number, and accepted a body claiming `200200` regardless of failed HTTP status. Added opt-in `requireVerifiedReceiver: true` for **Hybrid only**: requires 6–20 digit beneficiary account number and populated account name before provider request, and returns a trusted receiverValidated flag ONLY for a successful HTTP response with code `200200`.
- `prepareHybridInvoiceProof` requests strict Hybrid verification, and the private `evaluateSlipVerification` policy rejects `status: matched` without receiverValidated provenance. Review still manual Super Admin; nothing auto pays or unlocks a store. Old Delivery recipient behavior is retained except universal rejection of false success on non-2xx HTTP.
- Guarded Emulator-only fake verifier advertises receiverValidated=true for SYNTHETIC demo testing; not bank evidence. Updated pure proof tests and bank mock fixtures. New `test:hybrid-receiver-verification` (6 cases) added to `test:hybrid-billing` and tests malformed/missing recipient, true positive, HTTP spoofed `200200`, ambiguous bank status, fake provenance and dev-only gates.
- Direct source V8 test with injected fake provider and Firestore: **24/24 assertions passed**, not a native Node/Firebase Emulator run.
- Real beneficiary owner/receiver must still be validated operationally and the account configured in `platformPrivateSettings/slipVerification` (server private) before Production. An account name/number being syntactically valid does NOT prove account ownership, and the strict check does not perform a live payout or bank reconciliation.
- Remaining final Phase 10: real App Check, Slip2Go provider acceptance/UAT against the intended platform receiving bank, finance exception/refund/credit and suspension recovery acceptance, latest full Emulator/Browser UAT and owner release approval. Four Production payment/issuer/UI gates all remain FALSE; no deploy or main merge.

## 2026-10-24 — FINAL Phase 10: reviewer revocation safety + immutable finance audit UI

- User confirmed all tests on the previous GitHub HEAD `19ef9d37` passed on Mac. The Mac Remote Desktop Commander connection still reports OFFLINE, so **changes in this commit range require a new native Mac and Emulator verification**.
- Trusted private `functions/hybrid-billing-payment.js` now checks active Super Admin role **inside** the Firestore review transaction (not only the preceding private service authentication) and checks raw immutable ledger ID/version/signature, tenant identity, and attempt ID before approving/rejecting. No payment, event or tenant account state is mutated if validation fails. Pure source-level V8 fake-transaction checks: 29/29 PASS.
- Added Unit regression: reviewer demotion between preflight and transaction + forged invoice/attempt identity. Updated direct server and real Firestore Emulator fixtures to seed a trusted synthetic reviewer. Added real Functions/Auth Emulator scenario for inactive/revoked reviewer followed by successful authorized retry; **native Emulator not yet rerun**.
- Super Admin `/platform/hybrid-invoices` now has paginated read-only **Finance Review Audit Trail** sourced exclusively from server-written `hybridBillingPaymentEvents`. Displays invoice, review time, paid/rejected, reviewer, bank-vs-manual confirmation and a truncated note with digit-pattern masking. Does not show raw Storage slip paths, provider/OCR results or bank ref fields. Browser Firestore writes remain forbidden.
- All 3 Super Admin financial lists use tenant+refresh scoping, cursor pagination dedupe and synchronous in-flight protection to avoid stale previous-store disclosures or duplicate rows. Source-level static UI checks 8/8 and mocked audit adapter checks 2/2 PASS for new note/PII redaction (not real browser).
- Remaining Phase 10 go-live blockers: native Node tests, latest Firebase Auth/Firestore/Storage/Functions Emulator UAT, real Owner+Super Admin browser UAT, genuine Slip2Go receiver-bank + App Check verification, credit/refund/reversal policy and account recovery, and explicit owner Production authorization.
- **All Production finance flags remain OFF**, no deploy, no main merge. Preserve dirty local `public/**/index.html`. Suggested Mac checks: `npm run test:hybrid-invoice-payment`, `npm run test:hybrid-functions-safety`, `npm run test:hybrid-billing`, `npm run test:react-parity`, `npm run test:firebase-hybrid-emulator`, `npm run test:hybrid-functions-emulator`, `npm run build:react`.

## 2026-10-24 — Phase 10: Mac validation log received; one stale test fixed

- Mac terminal log received 2026-10-24: demo-browser npm script was missing LOCALLY because the Mac checkout was older than the GitHub feature HEAD. The latest GitHub `package.json` includes `test:hybrid-demo-browser`; **git pull --ff-only** is necessary after inspecting/preserving local dirty HTML.
- Mac `test:hybrid-billing`: 145 tests, **144 pass, 1 fail**. The sole failure was a source-text safety guard falsely matching the word `financeSlipClaims` **inside a comment** of the private upload-grant service; no real financial write was shown by that failure. Adjusted the assertion to ignore comment-only lines while retaining explicit executable-source checks for forbidden write/callable/upload operations.
- The older Mac React Production build ran and generated build-contract PASS, but does not validate latest GitHub Browser DEV demo changes. React parity invocation stopped at the same 1 failing Hybrid test before completing later suites.
- Latest Branch must be pulled and fresh `npm run test:hybrid-demo-browser`, `npm run test:hybrid-functions-safety`, `npm run test:hybrid-billing`, `npm run test:react-parity`, `npm run build:react` rerun. Browser/Emulator UAT is pending and Mac connector offline.
- Maintain all four release flags FALSE, no Production deploy/merge, keep Phase 10 as the sole remaining final phase.

## 2026-10-24 — FINAL Phase 10: Demo-only browser Owner → Review → Paid/Rejected

- User confirmed prior Mac test suite passed and asked to continue. Mac mini connector remained OFFLINE this turn. **New code in this turn is not Mac/Emulator/UAT verified**.
- Added DEV-only dual opt-in Firebase App config in `react-app/src/firebase/client.js`, isolated `demo-penguin-hybrid` project, instance-scoped emulator-connection guard.
- Added pure `react-app/src/data/hybridDemoProofTransport.js` plus SDK adapter `hybridDemoProofClient.js` calling only Emulator endpoints, validating grant/path/expiry/bytes/tenant/session and accepting **pending_review only**.
- Tenant React panel now presents Emulator-only upload button with progress, error, privacy warning and invoice refresh, while Production UI remains hard-disabled. Demo report skips the Production preview Callable entirely.
- Super Admin review panel has Emulator-only Approve/Reject backed by demo Review Callable. Production review buttons & flags remain false. Seed script `tools/seed-hybrid-browser-demo.mjs` creates demo-only owner/reviewer identities, tenant and immutable invoice, requires all loopback hosts.
- New `npm run test:hybrid-demo-browser` added to the hybrid suite. Source-level V8 mocked checks 19/19 passed before reviewer UX changes; NOT native Node/npm tests.
- Complete step-by-step Mac and browser UAT: `docs/HYBRID_PHASE10_BROWSER_EMULATOR_UAT_20261024.md`. No Prod deploy, no main merge, preserve dirty public HTML.
- **NEXT:** Native test/Emulator/React Build and real Owner+Super Admin browser UAT on Mac, then real App Check/receiving bank/Slip2Go failure modes/finance audit/credit+refund/recovery controls before Production release approval. Phase 10 is FINAL; no more subphase numbering.

## 2026-10-24 — Phase 10 continuation: grant-enforced Storage + atomic submit (native tests pending)

- Owner explicitly requested finishing in Phase 10, without adding Phase 10A/10B/C or Phase 11. Source already committed on feature/react-firebase-port; check latest HEAD.
- Complete grant enforcement was wired to Storage Rules with exact reserved UID/invoice/path/MIME/byte count/expiry/signature/active role, no overwrites; private trusted submit preflight rejects missing/stolen/expired/used grants, and payment staging transaction reads grant+actor, consumes grant atomically with invoice pending, payment attempts and shared dedupe claims. `requireUploadGrant` defaults TRUE; old direct unit transaction fixtures alone may pass FALSE.
- Demo-only real Auth/Storage/Functions UAT tests updated to call `demoHybridPrepareUpload` first, upload and submit via server grant, then authorize Super Admin review. Added negative tests for stolen/unreserved/expired grants and missing/consumed grants. React UI and Production endpoints remain hard-disabled.
- **Mac still OFFLINE. GitHub/source validation is not equivalent to Native test/Emulator passing.** Run `npm run test:hybrid-upload-grant`, `npm run test:hybrid-invoice-payment-service` (if script exists; otherwise `node --test tests/react-parity/hybrid-invoice-payment-service.spec.mjs`), `npm run test:hybrid-functions-safety`, `npm run test:hybrid-emulator-safety`, JDK21 `npm run test:firebase-hybrid-emulator`, `npm run test:hybrid-functions-emulator`, `npm run test:hybrid-billing`, `npm run test:react-parity`, `npm run build:react`. Analyze failures before production approval.
- Remaining final Phase 10 work: real bank/Slip2Go/AppCheck UAT, beneficiary verification, exception/refund/credit/suspension-policy UX, full E2E browser and device parity, owner signoff. No production deploy, no main merge. Preserve dirty generated `public/**/index.html`.

## 2026-10-24 — Phase 10A server-generated upload reservation (GitHub-only, Emulator UAT pending)

- Owner confirmed Phase 9 Mac tests passed. Current Mac Remote Desktop Commander device remained OFFLINE in this turn.
- Added private `functions/hybrid-billing-upload-grant.js`: strict allowlist (tenantId, invoiceId, MIME, fileSize), checks owner/admin using trusted users profile, rechecks profile and actual issued/rejected immutable invoice in one Firestore transaction, uses cryptographic 24-byte random attempt IDs, saves a server-only 10-minute upload reservation. Invoice and money status are unchanged.
- Demo-only `demoHybridPrepareUpload` HTTPS Callable added exclusively to guarded `functions/emulator-hybrid/index.cjs`; production bootstrap/index do not import/export the grant or callable. No Production deployment and no bank payments.
- `firestore.rules` explicitly denies ALL browser read/write on `hybridBillingUploadGrants`. Storage Rules are **not yet wired to grants**: return `uploadEnabled:false` and keep React Upload/Submit DISABLED until the next coordinated Rules+backend submission UAT phase; client-chosen IDs from Phase 8 test remain accepted in the old demo submit path only.
- Added pure contract and permission tests in `tests/react-parity/hybrid-upload-grant.spec.mjs`, wired to `test:hybrid-billing` and `test:hybrid-upload-grant`. Extended real Auth/Functions Emulator transport test and static safety tests.
- Pending native Mac commands: `npm run test:hybrid-upload-grant`, `npm run test:hybrid-functions-safety`, `npm run test:hybrid-functions-emulator` (JDK21), `npm run test:hybrid-billing`, `npm run test:react-parity`, `npm run build:react`. Do not claim passing counts until Mac confirms.
- Next Phase 10B: link immutable Storage creates to unexpired server grants and exact authenticated uploader UID, enforce grant on submit with byte/MIME reconciliation, update Phase 6/8 Emulator fixtures, then implement Emulator-only client upload end-to-end. Keep every Production payment gate false, no Merge/deploy, preserve dirty public HTML.

## 2026-10-24 — Phase 9 invoice async isolation hardening (GitHub-only; native Mac re-run pending)

- Owner-provided Mac command log at HEAD `123c207a`: `test:hybrid-tenant-proof` **6/6**, `test:hybrid-billing` **132/132**, full `test:react-parity` command proceeded into successful `build:react`; generated build contract PASS. These are results for **the preceding commit**, NOT post-change tests.
- Root cause identified by code review: concurrent invoice pagination could append a stale previous-tenant or previous-refresh response; preview requests could overwrite newer month/store results; `doc.data().id` could override trusted document ID in list adapter.
- Scoped issued invoice pages to tenant+role+refresh generation; stale page merges require original cursor and scope, duplicate invoice IDs are discarded. Scoped Preview to store+month with request-generation guard. Added a separate **Refresh invoices** button, which clears any selected local proof; the slip panel also resets if invoice status/amount changes.
- Added `react-app/src/data/hybridTenantInvoicePaging.js`, strengthened `tests/react-parity/hybrid-tenant-proof-ui.spec.mjs` with stale-scope, stale-cursor, dedupe and UI wiring tests. Kept production payment release flags OFF, unchanged Firestore/Storage rules, no uploads, bank requests or financial writes.
- Remote Desktop Commander reported Mac mini **offline**; therefore post-change native Node/Vite/Playwright/Emulator tests and actual Desktop/Mobile screenshot review are **not independently run**. The prior Mac log is not a substitute.
- Next Mac run: pull `feature/react-firebase-port`, preserve existing dirty `public/**/index.html`, run `npm run test:hybrid-tenant-proof && npm run test:hybrid-billing && npm run test:react-parity && npm run build:react`. Visually test both breakpoints and changing shop/invoice/month while a list request is delayed. No deploy/merge.

# Next Chat Handoff — React + Firebase Migration

## 2026-10-24 — Phase 9 closed tenant invoice evidence UX, UAT on Mac pending

- User confirmed Phase 8 Functions Emulator passed, but no attached result log or precise case counts in this turn; Mac Remote Desktop Commander was offline. Treat Phase 8 as owner-confirmed, not independently measured.
- New `/reports/hybrid-billing` issued invoice history shows per-invoice Prepare slip only for actual `issued` or `rejected` ledger records with valid ID/positive cent-accurate amount; `paid`/`pending_review` never offer it. Preview projections remain nonpayable.
- Added `react-app/src/components/HybridTenantProofPanel.jsx` with Thai/English local file selection, max 10MiB and JPEG/PNG/WebP/PDF restriction, selected name/size feedback, prominent warning NOT to transfer funds, disabled submit button. No backend function, Storage upload, bank payment, invoice status update, account instructions or localStorage persistence.
- Added `react-app/src/data/hybridTenantPaymentDraft.js` pure eligible-invoice/file validation and fail-closed `submitHybridTenantProof`; new `HYBRID_TENANT_PROOF_SUBMISSION_READY=false`. Prior server `HYBRID_PAYMENT_CALLABLE_READY=false`, React `HYBRID_PAYMENT_UI_READY=false`, invoice issuance off, no production callable export.
- CSS `react-app/public/parity/css/hybrid-billing-review.css` extended for mobile. `tests/react-parity/hybrid-tenant-proof-ui.spec.mjs` six tests (eligible, file types/size, local-only draft, submission hard lock, page integration, responsiveness/locale) PASSED in isolated JS harness 6/6; not native Mac. Added `npm run test:hybrid-tenant-proof` and included spec in `npm run test:hybrid-billing`.
- Mac commands after git pull: `npm run test:hybrid-tenant-proof`, `npm run test:hybrid-billing`, `npm run test:react-parity`, `npm run build:react`. Do not reset/clean dirty `public/**/index.html`, do not deploy. Full guide `docs/HYBRID_PHASE9_TENANT_EVIDENCE_PREVIEW_20261024.md`.
- Next release gates include true App Check, trusted beneficiary/bank verification, server-generated unique attempt IDs, full authenticated upload/Callable, receipt/credit note/refund, debt-only suspension, historical cross-channel shared claim reconciliation, before approving any Production financial release.

## 2026-10-24 — Phase 8 third Mac run reveals two missing discovery flags; custom dotenv-only solution awaiting native rerun

- Mac after ebd939bd: `test:hybrid-functions-safety` **10/10 PASS**, JDK21 and demo project correct; Functions discovery still blocked with `[failed checks: explicitDemoFlag, localFunctions]`. It received demo project plus Auth/Firestore/Storage loopback, but CLI child dropped custom shell flag `HYBRID_DEMO_FUNCTIONS_ONLY` and reserved `FIREBASE_FUNCTIONS_EMULATOR_HOST`; 8 integration tests `functions/not-found` 0/8 because no endpoint registered, no financial service reached.
- Added `functions/emulator-hybrid/.env.local` with ONLY allowed non-reserved custom values `HYBRID_DEMO_FUNCTIONS_ONLY=1` and `HYBRID_DEMO_FUNCTIONS_HOST=127.0.0.1:5001`, no secrets/credentials. Official Firebase Emulator supports `.env.local`; reserved FIREBASE_*, GCLOUD_PROJECT, GCP_PROJECT must NOT be in it.
- Updated emulator-only `functions/emulator-hybrid/index.cjs` guard: uses custom local Functions host marker to handle Firebase CLI dropping reserved host during discovery; still requires exact demo project across all available IDs, explicit test flag, and loopback Auth/Firestore/Storage, plus rejects any present reserved `FIREBASE_FUNCTIONS_EMULATOR_HOST` if it conflicts or wrong port. Production remains hard disabled and unexported.
- Updated `tests/react-parity/hybrid-functions-emulator-safety.spec.mjs`: checks the exact dotenv names/values, no reserved or secrets, no real-project activation, correct guard behavior under dropped reserved vars, and conflicting native host rejection. Static mock **12/12 PASS**. No Mac/real Firebase Functions Emulator run since this fix (Desktop Commander offline).
- Mac: git pull, JDK21 exports, `npm run test:hybrid-functions-safety`, `npm run test:hybrid-functions-emulator`; after green, full hybrid/parity/build. If failed, capture CLI `Loaded environment variables from .env.local` and `[failed checks: ...]` or next runtime error, never disable production guards.
- Full guide `docs/HYBRID_PHASE8_FUNCTIONS_EMULATOR_UAT_20261023.md`. No real Firebase deployment, no production data changes, no automatic invoice issuance, no activation of Hybrid payment Callable or approval UI.

## 2026-10-24 — Second Functions Emulator attempt still 0/8 due to import-time demo guard; redacted diagnostics added

- User's new Mac log, after syncing commit 40a4f8b6: Phase 8 local safety 9/9 PASS, Java 21 OK, Auth/Firestore/Storage/Functions emulators started for project demo-penguin-hybrid. During CLI function-discovery child, functions/emulator-hybrid/index.cjs line 27 still threw HYBRID_DEMO_FUNCTIONS_FORBIDDEN_OUTSIDE_LOCAL_EMULATORS. All 8 integration requests failed with functions/not-found because **no demo Callable endpoints registered**. Financial handlers were NEVER reached. Don't mistake 0/8 as failed financial workflows.
- Added fail-closed condition diagnostics in functions/emulator-hybrid/index.cjs. It now appends only names of failing checks (demoProject, noConflictingProject, explicitDemoFlag, localFirestore, localAuth, localStorage, localFunctions); it never outputs actual project IDs, hosts, tokens or credentials. No safety check weakened; no Firebase deploy or data writes.
- Expanded tests/react-parity/hybrid-functions-emulator-safety.spec.mjs with redacted failure reason test. Static isolated JS mock **10/10 PASS**. Real Functions Emulator has NOT been rerun since diagnostics were added.
- Official Firebase docs reserve ALL FIREBASE_* environment variable names in Functions .env files, as well as GCLOUD_PROJECT/GCP_PROJECT. An attempted functions/emulator-hybrid/.env.local containing those names was immediately reverted/deleted from GitHub; do NOT reintroduce them via .env.local. CLI runner continues explicit values in shell script.
- Next user Mac run: git pull feature/react-firebase-port; use JDK21 session; npm run test:hybrid-functions-safety; npm run test:hybrid-functions-emulator. If failed, capture the `[failed checks: ...]` phrase after HYBRID_DEMO_FUNCTIONS_FORBIDDEN_OUTSIDE_LOCAL_EMULATORS to identify exactly what the CLI discovery worker replaces/omits. Do NOT remove guards or export payment callables to Production to silence the error.
- All billing release flags remain OFF, React review buttons disabled, no master data changes, no deploy. See docs/HYBRID_PHASE8_FUNCTIONS_EMULATOR_UAT_20261023.md.

## 2026-10-24 — Phase 8 Mac Emulator 0/8 (guard/setup failure), source fixed, real rerun pending

- User pasted Mac log after pulling d9f57258: Phase 8 `npm run test:hybrid-functions-safety` 8/8 passed; Firebase CLI JDK preflight 21 OK, started demo emulators. Function discovery failed in `functions/emulator-hybrid/index.cjs` with HYBRID_DEMO_FUNCTIONS_FORBIDDEN_OUTSIDE_LOCAL_EMULATORS before server boot. Test before-hook missing FIREBASE_FUNCTIONS_EMULATOR_HOST, so all 8 integration tests failed at setup; **not evidence of 8 failed payment workflows**.
- Source fix to `package.json`: demo-only `test:hybrid-functions-emulator` explicitly sets GCLOUD_PROJECT and GCP_PROJECT to demo-penguin-hybrid and all four loopback host variables (Firestore 8080, Auth 9099, Storage 9199, Functions 5001) BEFORE Firebase CLI function discovery. Still invokes `--project demo-penguin-hybrid --config firebase.hybrid-functions-emulator.json` and does not deploy.
- Source fix to `functions/emulator-hybrid/index.cjs`: requires all FOUR loopback hosts, explicit test flag, and rejects conflicting project IDs from GCLOUD_PROJECT/GCP_PROJECT/FIREBASE_CONFIG before loading Admin SDK. No Production payment switch changed.
- Corrected `tests/firebase-emulator/hybrid-callable-transport.spec.mjs` review requests: review payload MUST OMIT slipPath (allowed for submit only). Added reviewData(...) that accepts only tenantId, invoiceId, attemptId, action, note and verifiedExternally.
- `tests/react-parity/hybrid-functions-emulator-safety.spec.mjs` now checks all supplied env vars, runtime guard real-project conflicts, valid demo guard, and review payload shape. Verified **9/9 in isolated JavaScript harness** and syntax parse of both source files. **Real Mac Emulator NOT RERUN** after fixes.
- Mac commands: git pull feature/react-firebase-port; session JDK21 export; npm run test:hybrid-functions-safety; npm run test:hybrid-functions-emulator; only after pass do test:hybrid-billing, test:react-parity, build:react. Protect modified public HTML, do not reset/clean, no Firebase Production deploy.
- See docs/HYBRID_PHASE8_FUNCTIONS_EMULATOR_UAT_20261023.md for failure analysis and safe retest. Log also warned host Node26 vs functions Node22 and ADC detected, but neither triggered initial guard failure. If later run reaches actual function handlers, diagnose any subsequent emulator/SDK issues using fresh logs.

## 2026-10-23 — Phase 8 demo-only real Functions Emulator HTTP Callable UAT (PENDING MAC EXECUTION)

- User stated Phase 7 Mac tests/React Build passed after removing the client reference to unexported payment Callable. Phase 6 Auth/Firestore/Storage Emulator UAT earlier passed 8/8. Phase 8 new Functions Emulator tests have NOT been run by Mac because remote Mac mini is offline.
- Added `functions/emulator-hybrid/` with its OWN package.json main `index.cjs`; distinct config `firebase.hybrid-functions-emulator.json` (Auth :9099, Firestore :8080, Storage :9199, Functions :5001 all localhost). Production `functions/index.js`/`bootstrap.js` are NOT changed, no production exports enabled.
- Emulator test entrypoint requires project `demo-penguin-hybrid`, explicit `HYBRID_DEMO_FUNCTIONS_ONLY=1` and all cross-service emulators on loopback **before** loading Firebase Admin; reuses `makeHybridPaymentHandlersForTest` with `enabled:true` ONLY in local demo. Endpoint names `demoHybridSubmitProof`/`demoHybridReviewProof`, distinct from prod. Deterministic synthetic Slip2Go-shaped fake verifier uses only bytes; it DOES NOT call live Slip2Go, banking, Vision or wallets. Demo onCall `enforceAppCheck:false` to isolate Firebase Auth role checks; real production onCall has true.
- `tests/firebase-emulator/hybrid-callable-transport.spec.mjs`: 8 real HTTP Callable client Auth test scenarios covering unauthenticated/cashier/inactive/cross-tenant denial, malformed/forged input, owner/admin submissions, pending→paid exactly once, super admin-only review, rejection/new proof, global SHA-256 duplicate against another store, and unchanged manual tenant suspension.
- `tests/react-parity/hybrid-functions-emulator-safety.spec.mjs` 8 static+runtime tests verified in isolated JS, including executing guard with a real project ID/nonlocal host and asserting Firebase modules NEVER load; syntax parsed for demo entrypoint and integration tests. Included in `npm run test:hybrid-billing` and `npm run test:hybrid-functions-safety`.
- Standalone `npm run test:hybrid-functions-emulator` JDK21+ preflight plus source security preflight then runs `HYBRID_DEMO_FUNCTIONS_ONLY=1 firebase emulators:exec --project demo-penguin-hybrid --config firebase.hybrid-functions-emulator.json --only auth,firestore,storage,functions ...` local demo only.
- Instructions: `docs/HYBRID_PHASE8_FUNCTIONS_EMULATOR_UAT_20261023.md`. Mac: git pull; JDK21 export; ensure `functions/node_modules/firebase-functions` exists; `npm run test:hybrid-functions-safety`; `npm run test:hybrid-functions-emulator`; if passed, `npm run test:hybrid-billing`, `npm run test:react-parity`, `npm run build:react`. No reset/clean for locally modified public HTML.
- Production gates still FALSE: `HYBRID_PAYMENT_CALLABLE_READY`, `HYBRID_PAYMENT_UI_READY`, `HYBRID_INVOICE_ISSUANCE_READY`; App Check live tokens NOT tested, server payment module not exported, no real payment, no Firestore Master mutations and NO DEPLOY.

## 2026-10-23 — Phase 7 Mac `test:react-callables` contract fixed (not yet rerun)

- Mac log: `npm run test:hybrid-payment-callables` **11/11**, `npm run test:hybrid-billing` **113/113**, React Foundation/Migration/Parity Matrix and P0 contract all passed, but `npm run test:react-parity` stopped on `test:react-callables`: missing server export `reviewHybridInvoicePaymentProof` referenced by `react-app/src/data/hybridPaymentActions.js`. Due to `set -e`, React build did not execute.
- Root cause: Phase 7 intentionally excludes private payment Callable module from `functions/index.js` and `bootstrap.js`, but its UI adapter still had a literal `httpsCallable(functions, 'reviewHybridInvoicePaymentProof')` reference. `tools/react-callable-contract.mjs` correctly enforces all browser Callable references map to exported endpoint names.
- Safe fix: removed `httpsCallable` from the unpublished React action, retained an always rejecting `reviewHybridPayment()` (`HYBRID_PAYMENT_NOT_RELEASED`/`HYBRID_PAYMENT_CALLABLE_UNREGISTERED`), kept `HYBRID_PAYMENT_UI_READY=false` and `HYBRID_PAYMENT_CALLABLE_READY=false`; server entrypoint STILL does not expose money-changing APIs.
- Updated `tests/react-parity/hybrid-payment-review-ui.spec.mjs` so a future accidental client ref to an unregistered financial Callable fails. UI tests 5/5 passed isolated JS mock. **Native Mac `test:react-callables`, full Parity and `build:react` PENDING rerun.**
- Mac safe commands after git pull: `npm run test:hybrid-payment-callables`; `npm run test:react-callables`; `npm run test:react-parity`; `npm run build:react`. Do NOT deploy Firebase or reset dirty generated public HTML.
- Details `docs/HYBRID_PHASE7_PAYMENT_CALLABLES_20261023.md`. Actual Functions Emulator invocation and strict Super Admin API auth still need separate UAT prior to any release.

## 2026-10-23 — Phase 7 private Hybrid payment Callable and locked Super Admin review UX (NOT DEPLOYED)

- Latest user Mac **Phase 6** real demo Emulator: safety 7/7, Auth/Firestore/Storage integration 8/8 with exit 0 after optional ownerEmail Rule fix; previous React Parity and build had passed. Do not report Phase 7 Callable UAT as completed; only Phase 6 was run.
- New `functions/hybrid-billing-payment-callables.js`: App Check enforced named definitions `submitTenantHybridPaymentProof` (tenant owner/admin) and `reviewHybridInvoicePaymentProof` (Super Admin); strict allowlisted input, no client amounts/statuses, sanitized HttpsError, reuse private trusted Slip2Go transaction service. **`HYBRID_PAYMENT_CALLABLE_READY=false`**; module **NOT imported/exported by `functions/index.js` or `functions/bootstrap.js`**. No Function endpoint exists in deployment.
- UI: `react-app/src/components/HybridReviewDecisionPanel.jsx` renders bilingual finance review note, external bank verification checkbox, and permanently disabled Approve/Reject buttons for pending attempts; included on `/platform/hybrid-invoices`. `react-app/src/data/hybridPaymentActions.js` callable adapter has separate **`HYBRID_PAYMENT_UI_READY=false`**; no Firestore/browser money writes. Existing store invoice preview and real invoice history remain read-only.
- Tests: `tests/react-parity/hybrid-payment-callables.spec.mjs` 7/7 simulated; `hybrid-payment-review-ui.spec.mjs` 4/4 simulated; old `hybrid-invoice-review-ui.spec.mjs` 5/5 simulated. New tests wired into `npm run test:hybrid-billing`, standalone `npm run test:hybrid-payment-callables`. **Native Mac npm/Vite and Functions Emulator tests NOT run.** Mac mini remote was offline.
- Complete guide: `docs/HYBRID_PHASE7_PAYMENT_CALLABLES_20261023.md`. Next run Mac `npm run test:hybrid-payment-callables`, `npm run test:hybrid-billing`, `npm run test:react-parity`, `npm run build:react`; build a separate demo-only Functions Emulator integration suite and UAT secured Callables before production. Preserve existing public generated HTML and all master data.
- No Firebase Production Hosting/Functions/Firestore/Storage deploy, no real invoice issuance, auto subscription suspension or payment approval. Do NOT flip release flags merely to make buttons work.

## 2026-10-23 — User Mac Phase 6 UAT SUCCESS; Storage optional ownerEmail safe-read follow-up

- The user supplied full Mac terminal log in Markdown attachment: `npm run test:hybrid-emulator-safety` 6/6; **real** `npm run test:firebase-hybrid-emulator` 8/8 with exit 0 and proper emulator shutdown; `npm run test:hybrid-billing` 101/101; `npm run test:react-parity` completed; `npm run build:react` completed with `verify:react-build` PASS build 2026.10.19.526 /react/assets/index-DRAJQJOM.js.
- Denied Firestore Writes in log are expected assertions. Three `storage.rules` warnings line 58 `Property ownerEmail is undefined on object` originated from `tenantOwner()` accessing optional tenant `ownerEmail` directly. Follow-up commit changed tenantOwner to use guarded `firestore.exists(tenantPath)`, `data.get('ownerUid', '')`, `data.get('ownerEmail', '')`, nonblank auth token email; this does NOT intentionally grant new access.
- Extended `tests/react-parity/hybrid-emulator-safety.spec.mjs` to assert optional-field safeguards; **7/7 static tests passed simulated after update.** Real Emulator 8/8 was BEFORE this follow-up Rules change. MUST rerun once to verify the latest version; do not claim the warning fixed in real emulator until that run.
- Warnings from Vite CSS references/build chunk size were non-blocking; JS index chunk about 3.74 MB minified (784 kB gzip). React matrix reports verified actions 0/54 despite contract PASS; plan manual route/action UAT separately.
- No Firebase production deployment. Hybrid automatic invoice issuance/payment Callable intentionally remain off. Continue with explicit, permission-scoped review Callables only after latest emulator UAT and safety review, plus refund/credit notes, quota and suspension/recovery. Never reset local dirty `public/**/index.html`.
- Verification: `npm run test:hybrid-emulator-safety`, `npm run test:firebase-hybrid-emulator` (JDK21), then `npm run test:react-parity`/`npm run build:react` as necessary.

## 2026-10-23 — Emulator Storage overwrite security regression resolved in source (not yet rerun)

- User Mac now has Java 21 and Firebase CLI 15.34.0; `npm run test:hybrid-emulator-safety` 6/6 passed and the real demo-only `npm run test:firebase-hybrid-emulator` started. Real Emulator result **7/8**: all Firestore permission, cross-product claim, invoice replay, payment review tests passed; one Storage test failed because uploading the same object path twice was wrongly allowed.
- Cause: Storage uploader treats overwrites as CREATE, so `allow update: if false` by itself does not prevent overwriting (Firebase Tools issue #10302, confirmed also in production behavior).
- FIX COMMITTED: Hybrid slip Storage Rule `allow create` now includes `resource == null`, preserving tenant/issued-or-rejected-invoice/MIME/size checks; reuploads to an existing object must fail even when classified CREATE. `tests/firebase-emulator/hybrid-finance-security.spec.mjs` now tests identical overwrite, modified overwrite, metadata tampering, delete and compares originally uploaded bytes. Static preflight asserts `resource == null` and updated test coverage.
- JS static safety checks 6/6 and emulator test script parse 1/1 passed; **real Emulator NOT rerun after fix**. Need `git pull --ff-only origin feature/react-firebase-port`, session `JAVA_HOME` set to Homebrew JDK21, `npm run test:hybrid-emulator-safety`, `npm run test:firebase-hybrid-emulator`; if green, `npm run test:react-parity` and `npm run build:react`.
- No production Firebase Hosting/Functions/Rules deploy or Firestore writes; preserve dirty generated `public/**/index.html` and shop Master data. See `docs/HYBRID_FIREBASE_EMULATOR_UAT_PHASE6_20261023.md`.

## 2026-10-23 — Mac Firebase Emulator Java runtime blocker

- Mac test log: `npm run test:hybrid-emulator-safety` passed 5/5; `java -version` was Temurin 17.0.20.1, `firebase --version` was 15.34.0; `npm run test:firebase-hybrid-emulator` stopped before emulator startup with `firebase-tools no longer supports Java version before 21`. `set -e` prevented subsequent tests/build.
- Added `tools/check-firebase-emulator-java.mjs` preflight, prepended to `test:firebase-hybrid-emulator` npm script. Fail fast on Java <21 with Homebrew install/session-only `JAVA_HOME` instructions. Does not affect production Firebase or application runtime.
- Updated `docs/HYBRID_FIREBASE_EMULATOR_UAT_PHASE6_20261023.md`, and `tests/react-parity/hybrid-emulator-safety.spec.mjs` now covers JDK version guard; 6/6 static preflight assertions passed in isolated V8, Java 17 reject / 21 & 22 allow simulated successfully.
- Mac commands: `brew install openjdk@21`; `export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"`; `export PATH="$JAVA_HOME/bin:$PATH"`; `java -version`; `git pull --ff-only origin feature/react-firebase-port`; `npm run test:hybrid-emulator-safety`; `npm run test:firebase-hybrid-emulator`. Use JDK21 only in current Terminal; do not uninstall JDK17; no `reset --hard`/`clean` for dirty public HTML.
- Real Emulator UAT still NOT run; next wait for native log, address any SDK/rules failures, and only then run `npm run test:react-parity` plus `npm run build:react`. No production deployments or financial data changes.

## 2026-10-23 — Phase 6 local-only Firebase Emulator UAT (NOT RUN ON MAC)

- User asked to continue after Phase 5 crypto fixture regression. Mac mini Remote Desktop Commander was OFFLINE. No native Node.js, React build or Firebase Emulator run in this turn.
- New `firebase.hybrid-emulator.json` uses localhost 9099/8080/9199 for Auth/Firestore/Storage, loading real repo Rules. `npm run test:firebase-hybrid-emulator` invokes `firebase emulators:exec --project demo-penguin-hybrid` and guarded code refuses to run without loopback-only FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST and FIREBASE_STORAGE_EMULATOR_HOST.
- New `tests/firebase-emulator/hybrid-finance-security.spec.mjs` tests real Auth identities, cross-tenant Firestore get/list denial, paid status update forbidden even to Super Admin, global finance claim secrecy, Storage upload immutable owner/admin roles, invalid/paid invoice upload denial, concurrent Admin shared proof claims, idempotent invoices, pending-to-paid review exactly once and no shop access mutation.
- New `tests/react-parity/hybrid-emulator-safety.spec.mjs` enforces demo-only script and storage rules; in `test:hybrid-billing`, standalone `npm run test:hybrid-emulator-safety`.
- `storage.rules` now allows invoice-scoped proof upload only if a Firestore invoice actually exists and has `issued`/`rejected` status. Prevent paid/pending/nonexistent invoice proof uploads. Rules NOT deployed.
- V8 static safety tests 5/5 passed; new emulator test JS parsed. Actual Emulator pass/fail unknown pending Mac. No Firestore data, Master data, real payment, Hosting or Cloud Functions changed or deployed.
- Mac: `npm run test:hybrid-emulator-safety`; ensure functions/node_modules/firebase-admin exists (`npm --prefix functions install --no-package-lock` if absent); `java -version`; `firebase --version`; `npm run test:firebase-hybrid-emulator`; `npm run test:react-parity`; `npm run build:react`. Never reset local modified public HTML.
- Full guide: `docs/HYBRID_FIREBASE_EMULATOR_UAT_PHASE6_20261023.md`. Next: fix actual emulator failures and implement explicit closed-by-default authenticated payment Callable and reviewed approval UI; issuance stays hard off.

## 2026-10-23 — Mac Phase 5 npm failure fixed (no deploy)

- User Mac `npm run test:finance-slip-claims` 6/6, `test:hybrid-invoice-payment` 20/20, `test:hybrid-invoice-review-ui` 5/5, `test:hybrid-invoice-ledger` 15/15, and `test:hybrid-billing` 95/95 passed. `test:react-parity` stopped at `test:signup-billing-revenue-share`, assertion `Unexpected dependency node:crypto` (line 273), so `build:react` did not run (shell `set -e`).
- Root cause: Phase 5 `functions/revenue-share.js` added `require('node:crypto')` and `require('./finance-slip-claims')`; older isolated Cloud Function tests did not include these new legitimate dependencies.
- Updated `tests/react-parity/signup-billing-revenue-share.spec.mjs` to include Node crypto and real pure finance-slip-claims in dependency map; similarly updated `tests/react-parity/revenue-share-cutover-periods.spec.mjs` so its isolated billing fixture won't fail for the same reason.
- Simulated test execution after commit: previously failing Premium commission test passed; four `revenue-share-cutover-periods` tests passed. **Native Mac suite and React build still must be rerun.** These commits change TESTS ONLY and do not modify financial calculations, runtime code or Firebase.
- Safe Mac commands: `git switch feature/react-firebase-port`, `git pull --ff-only origin feature/react-firebase-port`, `npm run test:signup-billing-revenue-share`, `npm run test:billing-anniversary`, `npm run test:react-parity`, `npm run build:react`. Local `public/**/index.html` files are modified; NEVER reset/clean them blindly.

## 2026-10-23 — Phase 5 shared finance slip dedupe + read-only Invoice UI (NOT DEPLOYED)

- Owner said universal activation-anniversary billing for all stores; owner removes TEST transactional Firestore data, never master tenant/menu/product/config. Changes only to `feature/react-firebase-port`, no production Firebase Deploy.
- New `functions/finance-slip-claims.js`: SHA-256 of slip bytes and shared bank reference/transRef fingerprint under `financeSlipClaims`. Global claims are created in the same Firestore transactions as Wallet topups (`functions/tenant-lalamove-wallet.js`), Revenue Share slip payment (`functions/revenue-share.js`) and Hybrid pending-proof (`functions/hybrid-billing-payment.js`). Browser Firestore Rules deny all access to this root collection. Historical legacy records predating these changes are NOT automatically backfilled.
- Hybrid remains private; no Cloud Callable for proof approval, `HYBRID_INVOICE_ISSUANCE_READY=false`, `HYBRID_REGISTRATION_READY=false`, no invoice issuance/collection, no automatic account unlock.
- Super Admin read-only review added at `/platform/hybrid-invoices` via `react-app/src/pages/HybridBillingReviewPage.jsx` and Platform nav. Tenant owner/admin now sees actual issued invoice history on `/reports/hybrid-billing`, distinctly below its nonpayable estimate. Paginated Firestore client reads in `react-app/src/data/hybridInvoiceReviewData.js`. Thai/English and responsive CSS. No approval/payment/upload buttons.
- Tests: `npm run test:finance-slip-claims`, `npm run test:hybrid-invoice-payment`, `npm run test:hybrid-invoice-review-ui`, plus `npm run test:hybrid-billing`, `npm run test:react-parity`, `npm run build:react`. V8 simulated tests passed 6/6 shared claims, 11/11 Hybrid payment, 9/9 payment-service, 5/5 review UI static. Mac Node/npm/Vite and Firebase Emulator NOT run because connected Mac mini offline.
- Deployment blocker: modified Wallet, Revenue Share and Hybrid server code must be rolled out together with restrictive Rules AFTER emulator/UAT; otherwise another channel could accept a slip outside the new registry. Existing test payments need verified cleanup/backfill. Do not deploy this increment piecemeal.
- Full plan: `docs/HYBRID_FINANCE_SHARED_CLAIMS_PHASE5_20261023.md`. Next implement verified payment UI/callable and controlled invoice issuer, then refund notes/suspension/recovery/quota and emulator tests.

## 2026-10-23 — Phase 4 Hybrid Invoice Payment service (private, not deployed)

- Added pure bank-slip payment policy (`functions/hybrid-billing-payment-policy.js`), transactional proof staging / manual review (`functions/hybrid-billing-payment.js`), authenticated tenant admin and Super Admin private service (`functions/hybrid-billing-payment-service.js`).
- Owner/admin cannot set invoice total/paid status; server reads immutable invoice amount and Storage evidence; Slip2Go `200200` + amount match + bank reference only confirms bank evidence, and **still creates `pending_review`, NEVER auto paid**. OCR/Vision/fallback requires independently confirmed bank proof and substantive admin review note.
- `hybridBillingSlipReferences` global Hybrid dedupe claims are hashed from actual slip SHA256 and bank reference/transRef. Before stage/approval service also rejects references previously used in legacy Revenue Share or Lalamove Wallet topups via read-only collection-group search. **A shared atomic claim across legacy and Hybrid is STILL REQUIRED before go-live.**
- Super Admin manual approve/reject writes event and attempt/invoice status together in Firestore transaction; amount/signature unchanged; rejection remains possible even if legacy duplicate discovered; never auto-unlocks a tenant.
- Rules restrict Firestore hybrid invoices/attempts/events to tenant admin or superadmin read only; deny browser writes. Storage supports immutable invoice-scoped uploads for tenant owner/admin only. **NO Rules deployed**, emulator checks pending.
- Private payment modules absent from `functions/bootstrap.js`, issuance remains hard off. 11/11 and 9/9 test cases passed in isolated V8 mocks; native Mac npm and Rules Emulator pending.
- New specs `tests/react-parity/hybrid-invoice-payment.spec.mjs` and `hybrid-invoice-payment-service.spec.mjs`, script `npm run test:hybrid-invoice-payment` wired into `test:hybrid-billing` and overall parity suite.
- Full notes `docs/HYBRID_PAYMENT_PHASE4_20261023.md`. Next implement shared cross-product atomic reference registry, authenticated Cloud callable and Super Admin payment-review UX; then refund/credits and recovery, emulator UAT. Do not bulk delete Firestore master.

## 2026-10-23 — Phase 3 Hybrid invoice ledger implementation candidate (NOT DEPLOYED)

- Current GitHub branch: `feature/react-firebase-port`. Owner explicitly chose new activation-anniversary billing for ALL shops before real users; master tenant/menu/product data preserved. No manual cutover approvals or legacy-mode exemptions.
- Added pure `functions/hybrid-billing-ledger.js`: deterministic stable SHA-256 invoice signatures, day-close gating, sealed historical paid Delivery sales checksum, immutable pricing snapshots, paid/status preservation and hard-fail on refund/sales drift.
- Added private Admin transaction `functions/hybrid-billing-persistence.js`: creates only missing `hybridBillingPeriods/{cycleStartDate}` and `hybridBillingInvoices/{invoiceId}` docs, validates previous seal and invoice identity inside transaction, idempotent retries; no browser mutation.
- Added private server read-only orchestrator `functions/hybrid-billing-reconciler.js`: trusted server order paidAt scan, store anniversary cycle, period pricing snapshot, existing issued invoice reads; `HYBRID_INVOICE_ISSUANCE_READY=false`, not imported from `functions/bootstrap.js` and no callable/scheduler.
- Firestore rules explicitly tenant-admin/Super Admin read-only for these new subcollections; no client create/update/delete. Rules NOT DEPLOYED.
- Read-only Hybrid preview now always prefers existing locked period config, otherwise central current settings; removed legacy tenant trial pricing override.
- New tests `tests/react-parity/hybrid-invoice-ledger.spec.mjs` and `hybrid-invoice-reconciler.spec.mjs`, bound into `test:hybrid-billing`; also `npm run test:hybrid-invoice-ledger`. Mock V8 suite passed initial 9/9 ledger and 5/5 orchestration; native Mac/Emulator verification still pending. Do not claim end-to-end successful deployment.
- Next: slip upload/Slip2Go verified invoice settlement, Admin approve/reject/audit, invoice UI, adjustment notes, quota, debt suspension/recovery, emulator UAT. Never combine Lalamove prepaid shipping with Platform share collection.
- Full specification: `docs/HYBRID_INVOICE_LEDGER_PHASE3_20261023.md`. No Firestore data, master records, subscription status, hosting or Cloud Functions were changed.

## 2026-10-23 — Owner overrides all former legacy Cutover restrictions: UNIVERSAL NEW BILLING

- IMPORTANT FINAL DECISION: No real customers and no real sales in Firebase. ALL old and future stores use the activation-date monthly anniversary cycle now. SHOP_1/2/3 must not be blocked from calendar reset by legacy billingMode, yearly plan, or suspended status; access suspension is independent and must not be lifted implicitly.
- `functions/revenue-share.js` removed `billingAnniversaryEffectiveAt` migration guard; monthly reports, prior monthly periods and Delivery threshold progress now use `tenantAnchorDate` for every store. Missing anchor fails closed; empty legacy `billingMode` no longer exempts eligible Delivery-capable store from central threshold rules.
- `functions/revenue-share-policy.js` no longer branches on effectiveDate. `functions/public-signup.js` persists one stable `billingCycleAnchorAt`; it no longer creates redundant cutover approval metadata.
- `functions/hybrid-billing-preview.js` now allows any anchored tenant (no hybrid_v1 tenant flag gate); first billing cycle and minimum month derive from original activation. Hybrid preview report and Home Dashboard now expose the preview to all owner/admin stores. **Preview does not issue invoices or process payments.**
- HYBRID_REGISTRATION_READY remains false; operational Hybrid charges, ledger, Slip2Go collection, refund and suspension/recovery have NOT been released. Do not double-collect via Revenue Share and Hybrid preview.
- OWNER will manually delete only selected TEST operational Firestore data. Do not run bulk deletes or delete tenant and product/menu master from this chat.
- `docs/UNIVERSAL_BILLING_PRELAUNCH_20261023.md` is canonical and supersedes ALL earlier cutover dry-run plans. Do not require approval or wait for future specific tenant dates to use the shared calendar rules.
- Mac full npm tests / React build still need execution after these commits; GitHub changes are not deployed.

## 2026-10-23 — Three-tenant anniversary cutover dry run and legacy-date safeguard

- Native Mac parity tests passed before this iteration. Read-only Firestore inventory of 3 tenants showed only two flags per shop: missing explicit approved anchor and missing authorized cutover. No `revenueSharePayments` or overlaps; scan not truncated.
- Anonymous SHOP_1: revenue share DAILY, active, original anchor 2026-06-21. Next possible reset 2026-11-21; still needs manual approval. Subscription expiry is separate.
- SHOP_2: legacy yearly Premium, `billingMode` empty, suspended with a reason, anchor 2026-07-04. Candidate 2026-11-04 BLOCKED until subscription classification, suspension, and expiry are reviewed; never activate automatically.
- SHOP_3: legacy monthly Premium, `billingMode` empty, active, anchor 2026-06-22. Candidate 2026-11-22 BLOCKED until existing Premium entitlement and expiry are reviewed.
- Added pure local-only dry run `tools/billing-anniversary-cutover-plan-core.mjs`, CLI `tools/plan-billing-anniversary-cutover.mjs`, tests `tests/react-parity/billing-anniversary-cutover-plan.spec.mjs`. Planner reads existing JSON, writes new private JSON outside Git, checks stale/incomplete audits, overlap, ambiguous billing mode, pending slips and suspension. NO Cloud connections, no changes to Firestore, no auto approvals.
- Corrected `functions/revenue-share-policy.js` and `functions/revenue-share.js` so pre-cutover dates stay on legacy calendar-month threshold rules. Only after a recorded effective cutover does threshold grouping/reset switch to tenant anniversary, and incomplete monthly transition cycles are not charged as new monthly invoices. Daily share slip billing stays daily; Premium expiry/status unchanged.
- Tests in V8 simulated harness: anniversary 10/10, cutover dry run 9/9, revenue report static 7/7 and existing Premium pricing mock passed. Native npm suite for these NEW changes not yet run, no production Firebase deployment or migration.
- Mac commands: `git pull --ff-only origin feature/react-firebase-port`; `npm run test:billing-anniversary-audit`; `npm run test:billing-anniversary`; `npm run test:react-parity`; optionally run cutover plan CLI against Desktop's audit-20261023-191156.json.
- Before deploying or migrating: reread live invoice/payment history near the cutover date; reconcile billing rights and future sales; obtain explicit sign-off on a non-overlapping per-tenant transition; implement separate idempotent audited migration. In particular preserve SHOP_2's suspension and both Premium expiries.
- Plan: `docs/BILLING_ANNIVERSARY_AND_ICONS_20261023.md`.

## 2026-10-23 — Anniversary billing instead of calendar-month threshold; IconPacks research (not deployed)

- User confirmed current THB 59 payment report fixed in live UI; new request: each store's billing period and Delivery threshold reset **on its own signup/activation anniversary date**, e.g., day 5/8/11/15/16/22, not on the 1st.
- Added `functions/billing-anniversary.js` pure Bangkok calendar anniversary helper, 29/30/31 clamp without drift (Jan 31 → Feb 28 → Mar 31), future `billingCycleAnchorAt` captured on new tenant activation in `public-signup.js`.
- `revenue-share-policy.js` Delivery eligible days now bucket by anchor cycle; `revenue-share.js` cumulative progress, monthly filter, and previous billed period use the same tenant anchor. React revenue report displays the cycle's **start and end dates**, even when the cycle crosses calendar months.
- **Migration safety**: existing legacy calendar-month invoices must not silently create overlap or accidental suspensions. Existing legacy tenant scheduler skips anniversary suspension unless a verified `billingAnniversaryEffectiveAt` is explicitly set following audit/cutover. This remains pending; do not backfill production records without approved mapping.
- Hybrid billing preview calculator now accepts cycle start/end, paid-at query aligned to tenant cycle, frontend preview shows cycle dates. Compatibility wrapper `calculateMonth` retains old tests. `HYBRID_REGISTRATION_READY=false`; still no live invoicing engine.
- Added `tests/react-parity/billing-anniversary.spec.mjs` (8 mocked unit/static cases pass in connector V8), wired into both `test:revenue-payment-bank-picker` and `test:hybrid-billing`. Native Mac Node/npm, staging emulator, deployment, migration, and production data verification **not performed** because Remote Desktop Mac offline.
- Iconpacks.net motorcycle icons commercial terms checked: use/download individually selected SVG/PNG in websites/apps, no attribution required; no standalone redistribution, resale, icon-platform competition or bulk scraping. **No assets or UI changed** yet; proposed pilot Delivery scooter icon, store icon, takeaway icon. See `docs/BILLING_ANNIVERSARY_AND_ICONS_20261023.md`.
- Legacy 30-day subscription trial and manual administrator subscription extensions are **not changed** by this anniversary-share update: separate policy and cutover validation needed before modifying existing membership commitments.


## 2026-10-23 17:54 — THB 59 still visible after dispatch-only deploy (corrected report code; deploy pending)

- User supplied production screenshots for `/reports/revenue-share` dated 22/10/2026: Delivery goods THB 690, eligible share THB 0, Lalamove THB 118, yet the old live report still showed THB 59 Platform due and requested a payment slip. Last deployment was only `functions:placeTenantLalamoveDispatch`, so it did **not** change live `getTenantRevenueShareSummary`, `submitTenantRevenueSharePayment`, `getPlatformRevenueShareSummary`, reconciliation callables, or Hosting.
- Current `functions/revenue-share.js` already calculates `platformAmountDue = setting.enabled ? revenueShare : 0` and denies a zero-share slip; to become live, the revenue callables need targeted deployment.
- Updated `RevenueShareReportPage.jsx` with defense-in-depth: payable amount and payment form use `platformSharePayable` derived only from `summary.revenueShare`, ignoring old Lalamove gaps. Historical slip documents preserve original recorded amount for audit but not new payable. Updated `tests/react-parity/revenue-share-current-settings.spec.mjs`; seven report static regression checks passed in V8 mock harness, **not native npm**.
- Deploy plans in `docs/LALAMOVE_PREPAID_DISPATCH_20261023.md`. Rollout report callables plus Hosting only after local tests and Hybrid registration fail-closed verification. No production Firestore data writes or reconciliation of existing THB 59 payment records were done from GitHub. Mac mini Remote Desktop Commander still offline.


## 2026-10-23 — Lalamove prepaid atomic dispatch / THB 59 safeguard (GitHub change, NOT deployed)

- Direct GitHub updates on `feature/react-firebase-port`: `functions/lalamove-dispatch.js` now reserves the quoted Lalamove delivery fee and stores a one-order lock in the same Firestore transaction BEFORE calling the provider; serializes concurrent requests and finalizes provider order + debit atomically.
- Definitive provider failure refunds the reservation once. Ambiguous provider/network results remain locked for manual reconciliation (never auto-refunded or retried). Successful provider fee increases/decreases use Wallet-only atomic debit/refund adjustments; insufficient additional credit is held for review, never invoiced as Platform debt.
- Revenue Share report already computes `platformAmountDue` from revenue share alone; historical THB 59 payment records were not deleted or rewritten and must be inspected against production Firestore separately.
- Tests `tests/react-parity/lalamove-prepaid-atomic.spec.mjs` with 10 mocked cases, wired to `npm run test:lalamove-prepaid-atomic` and `test:lalamove-auto-status`; simulated 10/10 PASS via JavaScript V8 harness. **Native Mac Node/npm tests, production Firestore audit and Firebase deploy not performed** (Mac mini MCP device offline).
- Only targeted callable function deployment is warranted after native tests: `firebase deploy --only functions:placeTenantLalamoveDispatch --project chat-45754`. Do not deploy Hosting/other Functions due unfinished Hybrid Billing; `HYBRID_REGISTRATION_READY=false` remains.
- Full scope and manual reconciliation policy: `docs/LALAMOVE_PREPAID_DISPATCH_20261023.md`.


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

## 2026-10-31 — Cross-system six-screen visual parity candidate 0.4.299 / 2026.10.31.529 (NOT DEPLOYED)

- PENGUIN receipt detail cancellation banner precedes bill number/print action as in LUKKAJA. LUKKAJA receipt print copies PENGUIN actor watermark, red number and historical display amount in its own branch. No actual finance changes.
- PENGUIN Revenue Share billing cycle and first registration date use Thai short-month two-digit Buddhist era, e.g. 18 ต.ค. 69 - 17 พ.ย. 69. Canonical dates, anniversary math and tenant values remain unchanged.
- Optional Premium disclosure now includes LUKKAJA style MerchantServiceTerms with PENGUIN brand, fee numbers derived from access only, source threshold/share rate and explicit text that billing and Slip2Go quota enforcement needs separate verification. Does not enable or charge services.
- Tests: 8/8 dedicated billing/visual tests, full React Parity and Vite Build PASS. First full suite failed two Hybrid Billing tests solely due missing worktree functions/node_modules symlink; connecting sibling Functions dependencies for tests fixed both. Test-only links will be removed after verification.
- Version 0.4.299 / Build 2026.10.31.529 on review branch. Firebase Production remains Version 0.4.298 / Build 2026.10.31.528. No Production deployment, Firestore Rules or Functions changes.
