# LUKKAJA → PENGUIN: JSX-first / Firebase-adapted phased port

> **LATEST SOURCE REFRESH — 23 NOV 2026 (authoritative for next slice):**
> Source `cosmatch/lukkhaja@e60858c1` on `feature/lukkaja_bankalert_stripe`, Target
> `Natchanon45/food-order-app@e91f0615` on `feature/react-firebase-port`.
> New machine-readable full JSX inventory:
> [23 Nov audit (Markdown)](./LUKKAJA_BANKALERT_STRIPE_JSX_AUDIT_20261123.md) /
> [23 Nov audit (JSON)](./LUKKAJA_BANKALERT_STRIPE_JSX_AUDIT_20261123.json).
> The older 9/22 Nov sections below remain as *historical evidence*, not
> current line counts or completion claims. The page matrix
> [JSON](./LUKKAJA_TO_PENGUIN_PAGE_MATRIX.json) has been re-pinned.

## Current JSX and source-change baseline (2026-11-23)

| Metric | Source | Firebase target | Meaning |
| --- | ---: | ---: | --- |
| Direct page JSX | **65 files / 35,878 physical lines** | **52 / 30,394** | 52 same-name, 13 Source-only; these are *files*, not route counts |
| Direct component JSX | **86 / 12,590** | **51 / 6,587** | 36 same-name, 50 Source-only, 15 Target-only |
| Other React-root JSX | **5 / 486** | **6 / 790** | Platform/Auth/runtime adapters differ by architecture |
| **All included JSX** | **156 / 48,954** | **109 / 37,771** | Never treat raw line delta as unimplemented code or completion percentage |

The 23 Nov Source contains **3 new commits** relative to the previously
pinned `03d2aaee`, changing **8 React JSX files**, including **two new
components** (`LKShopPairingPanel.jsx`, `PublicAppDownloads.jsx`),
with **+454 net physical JSX lines**. No new Source page JSX file
or `PortRoutes.jsx` change occurred in those three commits.
Target meanwhile grew by **21 JSX files** since its prior
audit commit `c42b2981`. These must be re-evaluated for reuse rather
than copied/overwritten. See the audit JSON for all per-file LOC.

**Scope delta / recommended module order after re-baselining:**

```text
P0  Refresh Source/Target Git refs + 156-vs-103 JSX inventory           [DONE 2026-11-23]
│
├── P3  Customer DeliverySuccessPage UI parity                    [NEW SOURCE DELTA]
│       Paid/verification card, Stripe Sandbox badge toggle,
│       PromptPay confirmation presentation, three mobile icon actions,
│       matching source CSS and responsive layout
│       Gate: never infer bank payment from badge/redirect
│
├── P1/P2  LK Shop web/FCM integration                             [NEW SOURCE DELTA]
│         PlatformContactPage superadmin rooms + LKShopPairingPanel
│         AdminPage shop rooms (admin/cashier/kitchen) and revoke
│         HomePage public downloads + PublicAppDownloads
│         PaymentCompanionPairingCard / ParityFooter changes
│         Gate: scoped Firebase Functions/Auth, QR one-time use,
│         role-room permissions, token revocation, APNs/FCM readiness
│         Mobile Flutter apps/lk-shop tracked separately (NOT JSX)
│
├── P1–P6  Existing phase inventory and capability parity          [OPEN]
│         Respect completed Firebase adapters, previous tests,
│         source-only Master/Bridge files may not be real routes
│
└── P7  Whole-system desktop/mobile, Auth, emulator, provider
        regression and explicit deployment sign-off                [OPEN]
```

New Source touched **6 CSS files, 8 Go files, 87 Flutter LK Shop files,
22 Android companion files**, and supporting tests/docs (166 files total
across all extensions). These are dependencies but must not be counted
as JSX lines or migrated blindly. In particular, any new device
pairing / notifications in the Source uses Go server endpoints:
equivalent Firebase authentication and verified FCM device ownership
would be needed before enabling that behavior.

**Acceptance boundary:** the refresh updates inventory, per-page source
revisions and priority, *not* the functional parity sign-off of
all 65 page files. Number of verified pseudocode/action scenarios for
new files is **pending behavior-by-behavior extraction**.
Source is read-only, Target stays on its feature branch; no Firebase
Production deploy, account billing release or Source-to-Firebase finance
backfill occurs as part of refreshing the JSX plan.

---

> **2026-11-22 source refresh:** The owner now requires `feature/lukkaja_bankalert_stripe` at `03d2aaee` instead of the historical source below. See [current JSX audit and continuation](./LUKKAJA_BANKALERT_STRIPE_JSX_AUDIT_20261122.md) and its JSON ledger. Historical phase evidence is retained; revalidate against the new source before acceptance or release.

**Started:** 09/11/2026 (Asia/Bangkok)
**Phase 0:** initial GitHub snapshot and 65-page inventory **completed**; functionality migration **not yet started / not accepted**.
**Source (strictly read-only):** `cosmatch/lukkhaja` · `feature/react-golang-vite-tailwind-axios` · `e84c899028eb16c67401dcc05c5faed84bf48f63`
**Destination (only writable project):** `Natchanon45/food-order-app` · `feature/react-firebase-port` · baseline `d87fc3752efff126dc9846d7cbe844aa982840a2`
**Intended live URL (after a verified UI phase):** `https://penguin-food.web.app`
**Machine-readable page ledger:** [LUKKAJA_TO_PENGUIN_PAGE_MATRIX.json](./LUKKAJA_TO_PENGUIN_PAGE_MATRIX.json)

## Non-negotiable contract

1. LUKKAJA **source JSX, components, CSS, typography, icons, markup, modal arrangement, gestures, responsive layout, workflows and supported languages** are the reference. Copy from the pinned source first, **do not redesign** the page or blindly preserve PENGUIN drift. Brand-specific labels/assets appropriately remain **PENGUIN** on the destination.
2. Convert only the data/service boundary: LUKKAJA Go/SQL/HTTP/session and related integration facades to PENGUIN **Firebase Auth, Firestore, Storage, Cloud Functions, permissions and tenant scope**. When possible, keep the JSX's presentation tree and handler intent and implement equivalent Firebase adapters. Never import Go API handlers, SQL drivers, Go-specific auth, or private server credentials into browser bundles.
3. Reuse the existing PENGUIN React project, router, Firebase config, collection conventions, Cloud Functions and tested working flows. Do not create another application or duplicate structures. Where LUKKAJA and PENGUIN business rules differ, document the decision explicitly and gate writes before enabling them.
4. **Source must never be edited, committed, pushed or deployed** by this port. All PRs/commits go to destination `feature/react-firebase-port`. No merge to `main` without instruction.
5. GitHub-first each slice: review pinned source → edit/commit destination on GitHub → safe `git pull --ff-only` to Mac → static/unit/contracts + browser/emulator E2E → Build → commit generated Hosting assets as needed → Firebase deploy **only the approved/verified slice** to the existing URL → verify live bundle. **No blanket Cloud Functions, Firestore Rules or production finance deploy** as an unintended side effect.
6. **Never** copy LUKKAJA SQL, transaction rows, historical effective dates, payment slips, credentials or test orders into PENGUIN Production. Preserve PENGUIN tenants and billing history. Existing completed PENGUIN features must be compared before replacing.
7. Source M7 finance rules are **not automatically live/accepted** merely because React+Go source has them. Source's 09/11 production M7 report explicitly says monetary activation/holds/00:00–00:20 automation are OFF and migration/real-provider UAT remains gated. On Firebase, payment authorization, historical invoices, Slip2Go, settlement, COD fee and automatic suspension require separate business-rule agreement, isolated Firebase Emulator tests and explicit release approval.

## Existing 31 October port — REUSE, DO NOT REIMPLEMENT

A separate historical PENGUIN worktree/branch already exists:
- `feature/port-lukkaja-20261031` at `fe338e1d` (20 commits ahead of base `d87fc375`, 123 changed files), built against LUKKAJA source `f9a6ddcd655da5c8c12e023a28880c74246ef768`.
- Its original ledger is `docs/LUKKAJA_20261031_PORT_MATRIX.md` **on that historical branch**. It records verified/candidate work in Quick Order, Google-login Delivery address, Cashier/Kitchen cancelled/deferred Walk-in flows, Revenue Share presentation, receipts, Firebase Callables and Security Rules.
- The previous branch reports Firebase releases through `0.4.304`; this does **not** mean every signed action/physical print/provider flow is accepted, or that those patches are merged into `feature/react-firebase-port`.
- LUKKAJA source has **432 commits after** that historical `f9a6ddcd` reference through the new pinned `e84c8990` HEAD. GitHub compare returns 300 changed-file entries and can truncate very large comparisons; use route/component and behavioral diffs, not that list as an exhaustive inventory.
- **Reuse prior tested patches and evidence selectively.** Do **not** cherry-pick the entire branch (it includes Functions, Rules and financial candidate work), do not reset the separate worktree, and do not rebuild features that are already correct in the requested destination. Mark each prior feature `reuse_verified`, `needs_rebase`, or `superseded_by_source` after actual comparison.
- **Live deployment safety:** the historical branch has previously deployed Firebase Hosting/Functions/Rules. A docs-only Phase 0 must not deploy its older `feature/react-firebase-port` frontend to the same URL, or the site could regress. Before any P1 UI deployment, compare the currently served Hosting asset and release against the proposed destination build and explicitly preserve approved behavior.

## Verified baseline (file inventory, NOT validated functionality)

| Type | LUKKAJA source JSX | PENGUIN destination JSX | What this means |
| --- | ---: | ---: | --- |
| Direct `pages/*.jsx` files | **65** | **52** | All 52 destination page *filenames* occur in source; **13** source-only files need assessment |
| Direct `components/*.jsx` files | **70** | **25** | **45** source-only components may be needed (or source-specific) |
| JSX visual / action parity signed off | **0 in this new migration ledger** | **0** | Existing working code is preserved, not automatically reclassified as ported |
| Action scenarios / pseudocode entries | **not yet exhaustively inventoried** | — | Count by page during each Phase, do not invent totals |

Source-only JSX includes `AdminStoreMasterPage`, `CanonicalLaravelBridgePage`, `LaravelSessionPage`, `PortMissingRoute` and 9 `Pos*MasterPage` files. **These are not automatically 13 missing user-facing routes.** Check source routing and route intent before adding each. A same-named React page can differ materially; e.g. source `AdminTenantsPage.jsx` (2,341 lines) vs destination (1,578 lines), and source `RevenueShareReportPage.jsx` (1,035 lines) vs destination (788 lines) at the pinned snapshot.

## Phase tree and exact page-file scope

```text
P0  Baseline, component/UI/CSS inventory, source pin, test gates  [DONE: inventory only]
├── P1  Super Admin / Platform / Tenant                         7 JSX page files
│   ├── PlatformPage, PlatformOwnersPage, PlatformContactPage
│   ├── PlatformPricingPage, AdminTenantsPage, AdminUsersPage
│   └── SaasSetupPage
├── P2  Merchant onboarding / Auth / Admin                      10 JSX page files
│   ├── HomePage, LoginPage, RegisterPage, LegalPage
│   ├── AdminPage, AdminStoreMasterPage, AdminQrPage
│   └── AdminSalesReportPage, LaravelSessionPage, CanonicalLaravelBridgePage
├── P3  Public Storefront / Delivery / Takeaway                  8 JSX page files
│   └── DeliveryPage, DeliverySuccessPage, TakeawayPage,
│       PublicOrderPage, VerifyPage, PublicRouteMissingPage,
│       StorefrontCompatibilityEntry, PortMissingRoute
├── P4  Cashier / Kitchen / Quick Order / Waiting Queue          8 JSX page files
│   └── CashierPage, CashierReceiptPage, CashierTableQrPage,
│       QuickOrderPage, KitchenPage, WaitingQueuePage,
│       WaitingQueueCustomerPage, WaitingQueueDisplayPage
├── P5  Retail POS                                               29 JSX page files
│   ├── Catalog / Products / Categories / Customers / Suppliers
│   ├── Purchases / Payables / Stock / Shifts / Sales / Returns
│   └── Receipts / Tax invoices / Settings / Users / Backup / Display
├── P6  Revenue Share / Hybrid Billing / M7                      3 JSX page files
│   └── RevenueShareReportPage, HybridBillingReportPage,
│       HybridBillingReviewPage
└── P7  Cross-phase end-to-end, visual parity, security, rollout  [no new page quota]
```

**Total: 65 distinct source JSX page files assigned to exactly one Phase.** Exact per-page mapping, existence flag and acceptance columns are in the JSON ledger.

### P1 — Start here: Super Admin, seven page files

**P1.1 incremental Hosting release verified (09/11/2026):** source-equivalent Firebase settings readiness/error guards implemented in the original Platform JSX. Destination code reconciled against deployed October 31 release. PENGUIN **0.4.305** / Build `2026.11.09.535` deployed Hosting-only from `feature/react-firebase-port@fb3d249f`; live JS asset byte-identical. Full React tests, 12/12 release preservation gates, 2/2 demo Auth/Firestore Emulator regression tests, and 17/17 anonymous route checks passed. **Not fully accepted:** signed-in Super Admin settings/visual UAT and platform write-provider tests pending. [P1.1 audit](./LUKKAJA_P1_1_PLATFORM_AUDIT.md) / [22 grouped action families, 4 pseudocodes and 18 scenarios](./LUKKAJA_P1_1_PLATFORM_ACTIONS.md). **P1.2 Tenant inventory now started**: [AdminTenants source JSX and Firebase contract audit](./LUKKAJA_P1_2_SUPERADMIN_TENANTS_AUDIT.md); no new Tenant write flow deployed.

- **P1.1 — Platform shell and dashboard:** bring `PlatformPage.jsx` source markup/styles/components into destination without changing the approved PENGUIN branding. Check buttons, notice bell, cards, navigation, locale, overlays, and permission guards. Reuse a Firebase adapter for branding/settings instead of source Go API.
- **P1.2 — Tenant workspace:** source `AdminTenantsPage.jsx` + dependencies such as `TenantControlPanel`, `SuperAdminNotificationBell`, owner/tenant review and source CSS, implemented with scoped Firebase Auth/Firestore/Functions. Inventory all create/edit/suspend/reset actions; **write actions require separate emulator approval**.
- **P1.3 — Users, owners and public contact:** source `AdminUsersPage`, `PlatformOwnersPage`, `PlatformContactPage`; verify role, staff, owner invitation and delivery of email before enabling create/disable actions.
- **P1.4 — Pricing and SaaS setup:** `PlatformPricingPage`, `SaasSetupPage`; UI first, audited Firebase settings and permissions. Do not silently turn on billing, migrate existing tenants or issue invoices.
- **P1 Done:** 7/7 audited JSX files, all actions inventoried, Firebase contract implemented, desktop/tablet/mobile parity, auth/permission tests, Emulator write tests and live-browser evidence; explicit status stored per page. A screenshot or build alone is not acceptance.

### P2 — Merchant Admin and onboarding

Keep source menu/table modal arrangement, image cropping/drag Y and hero/logo controls; mirror store settings, delivery fees/hours, prompts, onboarding, QR and signup into Firestore with Storage upload guards. Do not overwrite original first registration date with a later billing-cycle anchor. Source-only Master/Bridge/session page files are evaluated for **actual route necessity** rather than installed blindly.

### P3 — Customer-facing ordering

Port original public menu, cart, checkout, Lalamove quote and delivery flow. Match COD `30 THB` courier collection fee as a separately shown customer/courier amount when applicable; **do not add it to the shop invoice or share base**. Treat Slip2Go provider failures, mismatch, duplicate slips and manual review as distinct states. Multi-tenant read/write rules and idempotency are mandatory.

### P4 — Operations

Port cashier, kitchen, item revision/cancellation displays, receipt bill numbers, Telegram deep links, quick order, customer display and waiting queue. Test exact state changes across roles and offline/retry behavior. Never infer paid status from the slip image itself.

### P5 — Retail POS

**29 page-file scope**; deliver in smaller acceptance batches: product/catalog master → procurement/stock → sales/shifts/receipts → return/tax → users/settings/customer display/backup. Keep inventory and money writes transactional; use scoped Firebase adapters and do not introduce fake SQL-to-Firestore direct copy.

### P6 — Finance / M7 (separately gated)

**Hard gate: NO financial activation, historical backfill, automatic hold/suspension, provider verification, credit settlement or invoice issuance as a side effect of visual JSX porting.** Release requires a separately reviewed Firebase business contract, isolated-provider/Emulator acceptance, and explicit authorization.

Follow source JSX for readable presentation only while business rules and provider contracts are verified. Respect no retroactive billing for existing test stores, immutable original activation, owner/superadmin acceptance, correct cycle, `10,000 THB` Delivery threshold and `5%` excess-only rule under the accepted PENGUIN configuration; POS/table sales and Lalamove costs must not leak into Revenue Share. Do not automatically create invoices, suspend access, approve disputed slips or enable 00:00/00:20 jobs merely because the source UI has controls.

### P7 — System verification

Full route/action scenarios, tests and signed UI comparisons for PC, tablet and mobile, five-language strings, Firestore rules, Functions, webhook/provider failure handling, resource cost, rollback and deploy evidence. No `main` merge until explicitly requested.

## Per-page Definition of Done (tracker fields)

A page advances through: `source_ref_pinned` → `jsx_css_inventory` → `firebase_adapter_implemented` → `unit_contract_covered` → `browser_covered` → `emulator_data_verified` → `responsive_visual_verified` → `owner_accepted`.

Record at minimum for each page:
- routes, roles and original JSX/component/CSS list;
- functional action IDs and pseudocode for user flow, input, error, retry, duplicate-submit and side effects;
- LUKKAJA Go API/SQL contract → Firebase service/function/doc mapping with tenant scope, claims, indexes and error mapping;
- before/after screenshot evidence for desktop/tablet/mobile and locales;
- tests, results, source SHA, destination commit and Firebase release ID when deployed;
- unsupported differences and protected independent financial holds.

**Counting policy:** UI JSX files = 65 now; actual route count, pseudocode count and scenario count remain **pending inventory**, and are never inferred from filename count.

## Next actionable implementation slice

Continue **P1.2a** by adapting read-only JSX/CSS from source `AdminTenantsPage.jsx` and `TenantControlPanel.jsx`, pinned to LUKKAJA `e84c8990`, using the authorized Firebase service reads. Source read-only; do not wire new create-owner, override/suspend, payment/Slip2Go, refund or M7 approval controls until proper Firebase adapter/permission tests. Preserve P1.1 Hosting release and accepted PENGUIN-specific badges; no `main` merge.

**Phase 0 deliverables:** this plan; versioned JSON page ledger; a baseline-regression test. Documentation/scaffolding only; no production deployment is warranted until a source JSX / Firebase behavior slice is implemented and tested.

## 2026-11-23 updated Target JSX pin after P3

The Source baseline remains `e60858c1` with 156 JSX files / 48,954
physical lines. After the P3 Delivery Success UI module, Target
`1f3a039e` has **103 JSX files / 36,874 lines** (52 pages / 30,095;
45 components / 5,989; 6 other / 790).
The updated 23-Nov audit JSON has been regenerated from committed code,
and the Source and Target paths still match the pinned Git snapshots.
The +116 Target JSX lines here are a physical source count only, **not**
a declaration that the full 1,005-line Source Success page is ported.

## 2026-11-23 P3 Delivery Success UI module continuation

- New Source-derived three-action equal-width toolbar and shared green
  order-received card, PromptPay/Stripe/COD/Sandbox badges (payment
  status is never inferred from a badge).
- Read and subscription paths remain Firebase-only; original
  `CompanionConfirmedQr`, preview/download PNG and tracking retained.
- Stripe unpaid/failed stays separate; real Stripe execution, provider
  settlement, COD charging and refund remain gated.
- See `docs/LUKKAJA_P3_DELIVERY_SUCCESS_SOURCE_PARITY_20261123.md`
  for exact file scope and tested scenarios.
- This is **UI/safe-status parity only**, not acceptance of all
  Go/SQL Source DeliverySuccess functionality.

## 2026-11-23 P1/P2 LK Shop role-room Firebase Module

- Server-issued role-room single-use five-minute QR, atomic Firebase
  enrollment, private bearer-scoped native inbox, active device cap 10,
  global FCM token claim, revocation and strict Firestore denial.
- 4 role rooms: global Superadmin; tenant Admin, Cashier, Kitchen.
  Backend/Frontend modules integrated in Platform/Store/Admin and public
  Home pages without changing Telegram or finance settlement authority.
- Native Source Flutter `apps/lk-shop` must still be adapted to
  `penguin-food.web.app` and built/tested separately. No fake or
  incompatible UAT APK is offered. Both LK Shop server and FCM send
  runtime gates remain OFF by default.
- See `docs/LUKKAJA_P1_LK_SHOP_FCM_QR_PAIRING_FIREBASE_MODULE_20261123.md`
  for precise acceptance and further native/APNs/FCM blockers.


## Final 2026-11-23 target snapshot after LK Shop Firebase role-room module

After `bd7a3374`, Target includes 105 tracked JSX files / 37,158
physical lines: 52 pages / 30,124 lines, 47 components / 6,244
lines, 6 other root JSX / 790 lines. Source remains pinned to
`e60858c1`, 156 files / 48,954 lines. The newly ported
`LKShopPairingPanel.jsx` and `PublicAppDownloads.jsx` explain the
two new Target JSX names, but their successful Browser/Emulator tests
do not imply the old native Flutter LK Shop APK is compatible.

The latest per-file audit and Page Matrix have been regenerated against
the feature Commit, not against generated React bundle files. Runtime
Firebase gates are still off and there was no Production deployment.

## 2026-11-23 Native LK Shop single-module Firebase port

The complete Flutter Source LK Shop code was ported read-only into
`apps/lk-shop` with distinct Android/iOS identifiers
`com.natchanon45.penguin.lkshop` /
`com.natchanon45.penguin.lkShop`, Version `1.0.0+1`,
PENGUIN-only QR/manual-code/REST/web link allowlists, device-secure
credential handling, role inbox and FCM navigation. The Firebase
backend's hash-random notification ID was corrected to a
transactional per-device monotonic sequence, matching the Flutter
notification cursor and FCM data ID. MockClient Flutter tests,
native Flutter analyze, Android debug compilation and Firestore
Emulator UAT are recorded in
`docs/LUKKAJA_P1_LK_SHOP_NATIVE_FIREBASE_MODULE_20261123.md`.

The new Android/iOS application registrations and real physical-device
FCM/APNs validation are not supplied: **native Production push is
still blocked** and default gate remains OFF. No Firebase deploy,
payment change or Source modification was made in this module.

### Local validation of the full native LK Shop code module

24/24 native Flutter tests, static analysis, Android debug APK
compilation and iOS simulator Runner.app compilation passed.
The combined Firestore Emulator suite passed 88/88, React parity
passed, 114 Callable references remain resolved, and generated
React build contract passed. These are local/dev evidence only:
provider FCM/APNs device proof and signed app distribution still
require authorized external provisioning. No Production push sent.

## 2026-11-23 P1.2c complete — Atomic Store + Owner creation and ambiguous operation recovery

The P1.2c module is completed at local Source-code / Emulator acceptance,
not Production release. The existing Source-like Superadmin Store →
Owner → Plan dialog now retains **only** its opaque operation UUID in
per-Superadmin session storage and blocks duplicate creation across
navigation/reload when Auth or Firestore may have committed but a
network response was lost.

A new server-only read-only Callable checks the authenticated
Superadmin's own operation, complete Store + Owner + Membership +
Slug + native Firebase Auth coherence and immutable original billing
activation. It reports `complete_verified`, `pending_review`,
`failed_released`, `review_required` or `not_found` without
creating another account, generating invoice debt, opening suspended
stores, backdating membership or restoring credit. A new operation ID
is permitted only upon confirmed terminal rollback or a field
validation rejection that occurs before any reservation.

The existing atomic provisioning Callable now leaves a reserved slug
locked if Firebase Auth `createUser` may have committed but returned
an indeterminate error. It also blocks legacy tenants with unindexed
colliding slugs and rechecks Superadmin authority inside both
Firestore transactions. Tenants and their first activation dates
are unchanged unless the new one-step creation itself succeeds.

Local acceptance: **16/16 combined Firebase Auth + Firestore Emulator
tests**, including five same-UUID and four same-slug concurrent
requests, plus **7/7 React policy/browser tests at 320/390/768/1440**;
the full `npm run test:react-parity` chain, all 115 current
Callable references and React generated build contract pass.
Source branch is read-only; no Production deployment.
Full module documentation:
`docs/LUKKAJA_P1_2_ATOMIC_OWNER_PROVISION_RECOVERY_20261123.md`.

P1.2d/e write-provider/financial override and final signed-in
Production UAT remain separate and **are not** accepted by this module.


## Final 2026-11-23 JSX snapshot after P1.2c Owner provisioning recovery

The Source remains pinned to `e60858c1`: **156 JSX files,
48,954 physical lines**. Target at feature commit `3b05210c` is
**106 JSX files / 37,321 physical lines**, comprising 52 Pages /
30,257 lines, 48 Components / 6,274 lines, and six other JSX /
790 lines. Target added one new
`TenantProvisionRecoveryNotice.jsx` component and 133 JSX lines
to `AdminTenantsPage.jsx` compared with the preceding native
LK Shop module. Page Matrix and per-file JSON inventory were
regenerated from committed source on both sides.

The one-operation Owner provisioning recovery is accepted only
for local code + Auth/Firestore Emulator and Browser tests, not
for Production UAT or financial settlement. JSX line count is
NOT a functional completion percentage.

## 2026-11-23 P1.2d — legacy membership and access controls (local module acceptance)

Following P1.2c, P1.2d closes the Superadmin **legacy
subscription** update path through one server-authoritative
transaction for Tenant + canonical public Slug + immutable
idempotent operation receipt, cross-checking the original
membership and stale-state/revision. A new read-only recovery
Callable and per-Superadmin/tenant opaque browser operation
lock handle ambiguous transport outcomes without double
30/365-day extensions, while preserving original signup/activation.

The card retains Source layout/responsive behavior with strict
0–30 grace-day validation and Bangkok end-of-day expiry.
Manual membership suspend/activate require confirmation and
cannot release independent security, M7 invoice, Revenue Share
or Hybrid holds. Plan migration remains gated until authentic
historical financial terms are reviewed.

Tenant page load no longer backfills missing historical
subscriptions or creates a free trial for older stores. The
subscription on-create hook is diagnostic only for incomplete
historical records; the legacy 00:15 expiry sync is transactionally
guarded against cross-tenant slug mismatches.
Firestore browser writes to subscription/access fields,
canonical public slug and operation receipts are denied;
Admin SDK transaction operations alone can change them.

Acceptance is **local/dev only**. This did not deploy a
Production build, mutate LUKKAJA Source, approve real payment,
migrate financial ledgers, or accept P1.2e finance workflow.
See `docs/LUKKAJA_P1_2_LEGACY_SUBSCRIPTION_ACCESS_CONTROL_20261123.md`
for test evidence and remaining blockers.


### P1.2d full local acceptance gate

28/28 combined Auth + Firestore Emulator tests, 11/11 pure
subscription-policy tests and 8/8 React contract/browser tests,
responsive at 320/390/768/1440 px. The entire React parity chain,
116 Function-Callable references (0 missing), generated-build
contract and Vite build passed. This is a **local Module completion**,
not signed-in live Production UAT or permission for financial settlement.

## Final P1.2d JSX inventory pinned to feature commit 60902489

Source `e60858c1` remains 156 JSX / 48,954 physical lines.
Target `60902489` now comprises **107 JSX / 37,493 lines**:
52 pages / 30,263, 49 components / 6,440, and six other /
790 lines. `AdminTenantsPage.jsx` is 1,708 physical lines and
the newly extracted `TenantSubscriptionControl.jsx` is 166
lines. The 65-source-page scope and all latest per-file LOC are
captured in the refreshed JSON ledger; no new Source route was
inferred. The source files are never modified by this audit.

P1.2d completed its **one full local module** with 28/28 combined
Firebase Auth + Firestore Emulator, 11/11 pure policy and 8/8
React browser/contract tests; full React parity and generated
build contract passed. No Production deployment, no `main`
merge, no financial provider settlement or M7 invoice activation.
JSX physical lines are an inventory metric, never a completion
percentage.

## 2026-11-23 P1.2e — Superadmin independent Tenant Access / M7 hold evidence triage

**Module scope:** read-only, source-aligned classification of
existing Firebase tenant access and suspected financial hold
metadata. This is **not** original Go HMAC/SQL/bank certification
or operational collection/suspension/unlock.

An authenticated Superadmin can expand a shop to inspect one
consistent Tenant+public Slug Firestore snapshot, with separate
Manual/Security, Membership, Delivery Revenue Share, Hybrid,
recorded M7 hold and TEST override categories. The Server
returns no financial authority, no verified unpaid balance and
no canSell=true. There is no issuing, accepting Paid, Credit
posting, HMAC creation, bank verification or Tenant mutation.
A missing or inconsistent source must display review required
rather than inventing a zero balance or opening a shop.

Client-side Superadmin Tenant status and module-access rows now
indicate **metadata, not verified operational permission**.
The M7 suspicious amount/count metadata can no longer label a
real overdue debt or claim automatic release. Additional M7
metadata fields are protected from Browser writes in Firestore
Rules even for Superadmin.

The Go/SQL source commit and JSX inventory remain pinned;
all Source files are read-only. No Production deployment or
`main` merge. Full reference:
`docs/LUKKAJA_P1_2_TENANT_ACCESS_EVIDENCE_TRIAGE_20261123.md`.

**Important:** P1.2e acceptance only means the **diagnostic
Module** is finished; operational M7 Source-certified hold,
real bank cash posting and automatic tenant recovery remain
separately gated.

### P1.2e final isolated local acceptance

Combined Firebase Auth + Firestore Emulator **39/39 PASS**
(P1.2c, P1.2d and P1.2e); new P1.2e pure policy
**14/14 PASS** and React/Chrome contract **3/3 PASS**,
including 320/390/768/1440 responsive snapshots.
Full `npm run test:react-parity` **PASS**;
Callable contract **117 / 0 missing exports**;
React Vite build and generated hosting contract **PASS**.
The signed original Go policy, independently authenticated bank
evidence, global bank reference claims and Service Credit ledger
are still absent from Firebase. No operational access release
was performed.


## Final P1.2e JSX audit pinned to feature commit 6f686392

LUKKAJA Source `e60858c1` remains **156 JSX / 48,954 lines**.
PENGUIN Target `6f686392` now contains **108 JSX / 37,618 lines**:
52 Pages / 30,263; 50 Components / 6,565; and six other
React-root JSX / 790. The new `TenantAccessEvidencePanel.jsx` contributes
99 JSX lines and the existing `TenantControlPanel.jsx` grows to
617 lines. The original source `TenantControlPanel.jsx` remains 611 lines.
All 65 Source page records and the source SHA remain unchanged.

P1.2e is a completed **diagnostic access-evidence module**,
not a verified financial settlement or M7 signed hold enforcement.
Its local acceptance: **39/39** combined Emulator tests,
**14/14** pure-policy tests, **3/3** browser/contract tests,
responsive 320/390/768/1440, full React parity, 117 supported
Callables with zero missing exports, and generated build PASS.
No Production deploy, Source change or `main` merge.

## 2026-11-23 P1.2f — complete Superadmin Master Edit / atomic Slug rename

A practical edit Module follows P1.2e's read-only Access
Evidence: Superadmin can now **safely update** the Tenant
master Name, URL Slug, phone, address and business category
through one atomic Firebase transaction, protecting the
public Slug from cross-tenant collision under concurrency.

The same transaction synchronizes Store Settings and
all existing user/membership mirrors and creates one
immutable operation receipt. Original activation,
subscription/signup prices, Owner account identity,
bank details, Revenue Share, M7 and Service Credit
remain unchanged. A lost-response recovery panel
requires exact operation + canonical Tenant proof
before allowing another edit. The legacy Callable
alias cannot bypass the new atomic contract.

This Module intentionally does not touch live deletion,
bank/credit settlement or Production; it has no effect
on the separate P1.2f Source/LUKKAJA read-only checkout.
See `docs/LUKKAJA_P1_2_ATOMIC_TENANT_MASTER_EDIT_20261123.md`
for complete acceptance and remaining blockers.

### P1.2f local acceptance

The P1.2f atomic Tenant Master edit module passes
**12/12** dedicated Firebase Auth/Firestore Emulator tests,
**51/51** combined P1.2c/d/e/f Emulator regression,
**8/8** pure policy tests and **8/8** Chrome contract/UI
tests across 320/390/768/1440 widths.
Callable contracts cover **119** references with **zero**
missing exports; React build and generated hosting contract
pass. Original signup, plans, Owner identity and financial
statuses remain untouched. The module is **not** a
financial settlement or deletion authority.


## Final P1.2f JSX inventory pinned to committed module e91f0615

Source `e60858c1` remains **156 JSX files / 48,954 lines**.
Firebase Target `e91f0615` now has **109 JSX files /
37,771 lines**, split into 52 Pages / 30,394 lines,
51 Components / 6,587 lines and six other JSX /
790 lines. `AdminTenantsPage.jsx` is now 1,839
physical lines, and the new
`TenantMasterEditRecoveryNotice.jsx` adds 22 component
lines. The source Checkout/Go/SQL files are not modified.
JSX LOC remains an inventory metric, not a completion
percentage or evidence of banking acceptance.

This Module's final accepted local gates are **51/51**
combined Firebase Auth/Firestore Emulator tests,
**8/8** pure master-edit policy cases and **8/8**
React/Chrome browser/UI cases, including four screen widths.
Full React parity **PASS**, Callable contract **119/0
missing**, Vite build and hosting-generated build
contract **PASS**. No Production deploy, `main` merge,
Owner account identity mutation, financial paid posting
or unrestricted Tenant deletion.
