# Delivery share collection — one real business workflow (scope correction)

Date: 25 October 2026. Source: owner-confirmed business rules. Branch: feature/react-firebase-port.
This is the real target; private synthetic Bank Evidence/Refund phases are NOT substitutes.

## Acceptance example (Asia/Bangkok)

- Tenant is activated **3 Oct 2026**: billing cycle **3 Oct–2 Nov 2026** (next reset: 3 Nov).
- Count ONLY verified-paid Delivery merchandise (after applicable refunds), never in-store,
  Retail POS, customer delivery fee, or already-deducted Lalamove prepaid Wallet costs.
- Central settings: Delivery threshold THB 10,000 per activation-anniversary cycle,
  rate 5%; first THB 10,000 is EXEMPT, NOT the assessment base.
- By 9 Oct cumulative sales THB 10,000 => share THB 0.
- On 10 Oct a further THB 1,500 paid Delivery => excess THB 1,500,
  share **THB 75** for that day, no charge on the first 10,000.
- That day's assessed share is payable by **23:59 Bangkok time, 10 Oct**.
  If not confirmed paid by that deadline, automated job on 11 Oct suspends
  service temporarily; the job must be idempotent and check already-approved
  receipts and all other access restrictions, not blindly overwrite them.
- Tenant submits a slip. Verified successful Slip2Go **with receiver, amount,
  date and duplicate checks** approves the receipt; outages/missing service
  go to Super Admin manual review, never automatic approval.
- Super Admin's verified approval unblocks only this billing suspension;
  rejected/undecided proofs cannot be reported as real bank payment.
- Cycle total/next payment and suspension state must be visible on the actual
  tenant owner and Super Admin screens, not merely on a separate demo report.

## Findings / state after scoped correction

- **CORRECTED, tested:** both pure Hybrid calculation and existing Revenue Share
  reporting calculate ONLY excess Delivery amounts over the threshold. Native
  tests: `npm run test:hybrid-billing` **351/351 PASS** and
  `npm run test:signup-billing-revenue-share` **18/18 PASS**.
  Added exact owner scenario covering anniversary, THB 75, due-date,
  next-day overdue logic, renewal reset.
- **ALREADY EXISTS but NOT WIRED TO HYBRID RELEASE:** Billing anniversary
  helper, paid Delivery order source; existing Revenue Share slip form,
  Slip2Go verifier, Super Admin review UI, and 00:20 Bangkok daily scheduled
  reconciler (restricted to historical Revenue Share, monthly for Premium).
- **NOT DELIVERED:** real Hybrid invoice issuance flag remains false;
  Hybrid payment callable flag remains false; new tenants cannot register
  Hybrid via public signup; new Premium subscribers skip Revenue Share
  suspension due to historicalSetting guard; daily Premium workflow and
  next-day enforcement have not been integrated/accepted. These are the
  remaining delivery blockers, not external bank-evidence research.
- **SAFETY:** No real collection/payment scheduling/release was activated
  by this change. Existing signed historical invoices may conflict with
  changed calculation and MUST receive explicit migration/reconciliation,
  never silent rewrite. No Production deployment.

## Exact next implementation objective (no scope creep)

Wire one authoritative server-side daily charge and payment ledger to the
existing owner/Super Admin workflows; change only the Premium Delivery
billing path as required while preserving unrelated legacy revenue share.
Use tested activation anniversary, trusted paid Delivery data and immutable
amounts. Implement idempotent 00:20 overdue enforcement and reversible
billing-only suspension, verified Slip2Go auto-review plus manual Super
Admin fallback, and test full Browser+Firestore Emulator end-to-end before
any Production activation. Do NOT announce it complete until real customer
flow and suspension/unlock pass end-to-end. Synthetic Bank Evidence/Refund
Proof workflows are out of scope and must not block this objective.

## 25 October 2026 — GitHub-first integration (NOT Production release)

The existing Premium Delivery commission branch now runs through the original
Revenue Share owner/Super Admin workflow rather than the separate synthetic
Hybrid bank-proof UI:

- Premium stores capable of restaurant Delivery use **daily** settlement, with
  the month-long 10,000 THB exemption reset at the account activation anniversary.
  Historical revenue-share monthly/day configurations stay unchanged; pure
  retail remains ineligible. `hybrid_v1` demo tenants remain excluded to avoid
  duplicating a second ledger.
- The real Bangkok 00:20 Revenue Share scheduler and Super Admin manual
  reconcile now inspect central Premium pricing when selecting eligible tenants
  (previously Premium was bypassed). Yesterday's unpaid delivery share creates
  a reversible Revenue-Share-only tenant suspension. Repeated jobs are no-ops.
  Submitted proofs awaiting manual check do not prematurely block the shop;
  invalid/rejected proofs are not accepted as paid.
- Owner/admin are allowed into their Revenue Share payment page while the
  revenue-only suspension applies, and the form selects the unpaid date.
- Premium proof processing requires Slip2Go with strict receiver/amount/duplicate
  validation. Missing/invalid service configuration is routed to manual
  Super Admin review, **never auto approved**. Verified receipt or explicitly
  reviewed approval can lift the billing hold, but not independent account holds.
- Source-only regression tests cover the amount, scheduler, pending/manual
  approval, reject before midnight and strict Slip2Go options.

**Acceptance gate:** native tests, Java 21 Firestore/Auth Emulator tests, React
build and manual owner/Super Admin UI tests must be executed against the final
commit before any production release. Do not deploy a financial scheduler
until the owner has inspected the sample 10 Oct 75 THB bill, next-day
suspension and manual/automatic-unlock behavior. Existing past billing rows
may need a one-time reconciliation; do not silently mutate prior paid rows.


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


## 2026-10-25 — Premium Delivery browser UAT bridge (local-only)

- Last native `tests/firebase-emulator/delivery-share-actual-workflow.spec.mjs` **PASS 1/1** after adding second-day 100 THB strict mocked Slip2Go auto-approval + Firestore claims and release. This is **not a real Slip2Go connection**.
- Previous UAT blocker: `firebase.hybrid-functions-emulator.json` served only private Hybrid callables; live Revenue Share browser page would report `functions/not-found`. Reused guarded `functions/emulator-hybrid/index.cjs` to expose only its required Revenue Share Callables; no Production export or automatic scheduler; manual Super Admin `reconcileRevenueShare` can simulate the overnight action in this local Demo.
- Local browser seeder `npm run seed:premium-delivery-demo` creates a synthetic Premium tenant and Auth owner/Super Admin, monthly cycle from 3 October, first THB 10,000 exempt and yesterday's THB 1,500 excess. It refuses non-local emulator hosts or non-demo project and does not overwrite existing receipts/orders.
- Under the demo-only guard, `inspectRevenueShareSlip` refuses all real bank or Slip2Go traffic and returns `config_required` to queue Super Admin manual review. Production's actual verification behavior is unchanged.
- To test browser: run the guarded existing Hybrid Functions Emulator with `HYBRID_DEMO_FUNCTIONS_ONLY=1` and local hosts, **restart it after updating source**, run `npm run seed:premium-delivery-demo`, run `npm run dev:react:hybrid-demo`, open `/login` then `/reports/revenue-share` and `/admin/tenants`. No Production deploy/merge until Manual UAT and real credential verification prerequisites are satisfied.


## 2026-10-25 — Final Github-first local verification, release gate

- **Business code HEAD:** `c4cdca96758382ed1a77d68f946a024eae55d97a`. All changes committed/pushed to `feature/react-firebase-port`, safely `git pull --ff-only` on Mac. No Mac-side uncommitted business code; generated `public/**` files are preserved.
- **Native Mac checks on this HEAD:** `test:hybrid-billing` **353/353 PASS**, `test:react-parity` **PASS** (no failures), `build:react` **PASS** (generated Build Contract PASS), local `node --test tests/firebase-emulator/delivery-share-actual-workflow.spec.mjs` **PASS 1/1** against Auth/Firestore/Storage Emulators. Guarded Functions Emulator safety suite **17/17 PASS**.
- **Local UI smoke:** Vite demo serving `http://127.0.0.1:5174/login` HTTP 200, local owner and Admin callable routes operational and reject unauthenticated calls HTTP 401. Authenticated Premium owner reads `getTenantRevenueShareAccess` and `getTenantRevenueShareSummary` HTTP 200 with anchor **2026-10-03**, daily payable **75 THB**, Delivery **11,500 THB**, share base **1,500 THB**, rate **5%**. The Admin browser screen has NOT been manually signed off.
- **Fixture:** `npm run seed:premium-delivery-demo` PASS, owner `premium-owner@demo.invalid`, Super Admin `premium-reviewer@demo.invalid`, password `EmulatorOnly123!`, sample payable day **2026-10-24**, month **2026-10-03–2026-11-02**. Owner route `/reports/revenue-share`; Super Admin route `/admin/tenants`. In Demo only, a Super Admin clicking review refresh calls `reconcileRevenueShare` to simulate the overdue day; no automatically scheduled cron exported from the Emulator.
- **Release status:** **SOURCE+EMULATOR VERIFIED, OWNER BROWSER UAT PENDING**. Real Slip2Go API keys/bank beneficiary verification have NOT been proven against the live provider; Demo intentionally blocks outbound verification and always queues manual review. Do NOT deploy Production Functions, merge `main`, release real payments, or silently rewrite old paid invoices until owner authorizes a reviewed launch and live provider checks are complete.

