# LUKKAJA → PENGUIN: JSX-first / Firebase-adapted phased port

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

Start **P1.1** from LUKKAJA `resources/js/react-port/pages/PlatformPage.jsx` pinned to `e84c8990`; compare against PENGUIN `react-app/src/pages/PlatformPage.jsx`. Identify exact markup, imported components and source CSS, then implement the Firebase-facing facade **without reformatting/reinventing the source JSX**, keep PENGUIN asset identity, and add browser parity tests. Continue P1.2 only after P1.1 earns its actual acceptance status.

**Phase 0 deliverables:** this plan; versioned JSON page ledger; a baseline-regression test. Documentation/scaffolding only; no production deployment is warranted until a source JSX / Firebase behavior slice is implemented and tested.
