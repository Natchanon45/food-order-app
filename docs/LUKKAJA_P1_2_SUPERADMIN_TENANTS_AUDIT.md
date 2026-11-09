# Phase 1.2 — Super Admin tenant management: source JSX / Firebase adapters

**Opened:** 09/11/2026; **status:** inventory started, no P1.2 source JSX or new financial actions deployed.

Source is **read only**: `cosmatch/lukkhaja@feature/react-golang-vite-tailwind-axios` pinned to `e84c899028eb16c67401dcc05c5faed84bf48f63`. Target remains `Natchanon45/food-order-app@feature/react-firebase-port`; no merge to `main`.

## Actual source-vs-Firebase JSX delta

| Item | LUKKAJA reference | PENGUIN existing destination | Disposition |
| --- | --- | --- | --- |
| Tenant management screen | `resources/js/react-port/pages/AdminTenantsPage.jsx` **2,341 lines** | `react-app/src/pages/AdminTenantsPage.jsx` **1,578 lines** at pinned baseline | Port JSX hierarchy by source sections; do not rewrite or replace existing Firebase functionality blindly |
| Source tenant control panel | `components/TenantControlPanel.jsx` **611 lines** | no matching component | Source has summary cards, finance ledger and manual override controls; adapter and permission review required |
| Source M7 source evidence | `components/M7TenantSourceEvidence.jsx` **246 lines** | no matching component | Read-only evidence candidate; Go API is not available in Firebase |
| Source M7 operational review | `components/M7OperationalOutageReviewItem.jsx` **54 lines** | no matching component | Includes approve/reject callbacks; **must not enable without verified backend provider contract** |
| Source backend | `data/laravelPlatformTenants.js` **605 lines** + Go/MySQL services | `react-app/src/data/platformTenantService.js` & `functions/tenant-admin.js` | Keep existing Firebase Callables, tenant scoping and audit; never copy source Go HTTP or SQL |
| Source new-store form | `createActiveTenantWithOwner` plus `tenantOwnerName`, `tenantOwnerEmail`, `tenantOwnerPassword`, `tenantNewPlanCode` fields | Existing Firebase `createTenant` and `createTenantOwner` are separate operations | Do not pretend this is atomic; requires server-admin onboarding transaction/rollback/verification before first use |
| Existing Firebase features | — | tenant notifications, searchable bank selector, existing revenue and subscription controls | Keep approved features; do not erase during JSX copy |

**Missing JSX IDs visible in LUKKAJA:** `tenantOwnerName`, `tenantOwnerEmail`, `tenantOwnerPassword`, `tenantOwnerPasswordConfirm`, `tenantNewPlanCode`, `m7OperationalDecisionDialog`, `m7OperationalDecisionTitle`, `m7OperationalReference`, `m7OperationalAmount`, `m7OperationalReason`. These IDs document source elements; they **do not authorize enabling** credential or money writes on Firebase.

## Port order inside P1.2

1. **1.2a — read-only / nonfinancial visual:** transfer source tenant card layout and summary geometry, exact CSS/component positioning, subscription and activation/billing labels, new-store form UI shell (inputs disabled where no certified transactional adapter). Preserve approved PENGUIN notification and tenant controls.
2. **1.2b — store reads:** map source tenant/control-panel read fields through `listTenants` / `normalizeTenant` / existing authenticated Callables, including first-registration dates, tenant business units, real suspension state and Lalamove wallet balances. Expose explicit Unknown on missing data and display only authorized fields. Cross-tenant readonly tests.
3. **1.2c — create new tenant + owner:** compare source's one-step flow with Firebase's separate `createTenant` / `createTenantOwner` functions. Design idempotent, server-authorized atomic or compensating transaction that will not leave an orphan tenant on failure; include email verification/SMTP readiness. Never fabricate owner credentials.
4. **1.2d — edit, suspend/unsuspend and subscriptions:** source switches and badges, Firebase server checks, explicit write permissions, audit metadata and rollback. Do not change a customer's billing-cycle anniversary or backfill old invoices.
5. **1.2e — finance/M7 review:** port JSX layout first; payout, wallet approval, Slip2Go human fallback, invoice, credit, COD reconciliation and manual payment buttons stay disabled/read-only until verified provider calls, signed entitlement and owner approval. **Do not enable 00:00/00:20 jobs or retroactive financial charges**.
6. **1.2f — acceptance:** compare source and destination pixel/DOM at the same role/test data and responsive widths (desktop/tablet/mobile), cover 5 locales, write authorization with Auth/Firestore Emulator, and UAT before Hosting deploy.

## Source functionality / Firebase contracts to map

| Source behavior | Firebase counterpart | Port gate |
| --- | --- | --- |
| tenant list, create, update, delete | `listTenants`, `createTenant`, `updateTenant`, `deleteTenant` Callable adapters | server super_admin permission + tenant scope + idempotency |
| create owner and registration plan | `createTenantOwner`; `functions/tenant-admin.js` | one-step first-use parity requires explicit transaction design and signed acceptance |
| subscription/status/membership | `updateTenantSubscription`, `backfillTenantSubscriptions` | no trial reset, no silent retroactive charge |
| revenue and Slip2Go history | `getPlatformRevenueShareSummary`, `listPlatformRevenueSharePayments`, `reviewRevenueSharePayment` | read-only until provider and finance rights checked |
| Lalamove account wallet/top-up | `getTenantLalamoveWallet`, `reviewTenantLalamoveWalletTopup` | state must be genuine, no refund settlement implied |
| M7 evidence/readiness | **no confirmed equivalent** of source `M7TenantSourceEvidence` API | read-only shell pending Firebase contract, do not produce fake Certified status |
| M7 operational outage approval/reject | **no confirmed equivalent** matching source decision contract | disabled until provider failure/duplicate/mismatch safeguards pass |

## Acceptance and release status

- **P1.1 Hosting release:** PENGUIN `0.4.305`, commit `fb3d249f`, passed full React parity, 12 baseline preservation checks, 2/2 demo emulator tests, 17/17 anonymous-browser route checks. Live JS asset byte-equal to Build. Signed-in Platform visual/mutation checks **pending**.
- **P1.2:** audit only; no new JSX, Firebase Callables or Rules changes issued at this step.
- **No** LUKKAJA edits, **no** main merge, **no** owner/test shop data copy or real money operations.

Next implement a **small read-only TenantControlPanel-derived source JSX slice** with server-scoped Firebase adapter and compare against source CSS before wiring any new controls. Do not replicate the 611-line component wholesale with dangling Go-specific imports.
