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


## 2026-11-23 — Completed P1.2c one-call Owner Provisioning Recovery Module

The earlier status at the top of this document is a **historical snapshot**
from the previous 09/11 P1.2 inventory. P1.2c is now implemented in the
Firebase target. The original Source stays pinned read-only at
`e60858c1`, and `AdminTenantsPage.jsx` keeps its Source three-step
New Store → Owner → Plan flow.

The existing `createActiveTenantWithOwner` Callable remains one
**logical** operation: Firebase Auth and Firestore are *not* a shared
atomic transaction. The implementation uses an idempotent UUID,
transactional slug reservation, Auth creation, atomic Firestore
tenant + owner + membership activation, Auth compensation and durable
operation status. This module closes the ambiguity gap across
provider/network interruptions instead of claiming distributed ACID.

New Superadmin-only read-only
`getPlatformTenantProvisionStatus({operationId})` reconciles
five records + native Firebase Auth, and explicitly classifies
`complete_verified`, `pending_review`, `failed_released`,
`review_required`, or `not_found`. The browser also independently
re-reads `listTenants` before claiming completion. A different
Superadmin cannot inspect another administrator's operation.

- Repeated UUIDs cannot spawn a second tenant or owner. A concurrent
  request that hits a reservation in progress returns a review state.
- Auth `createUser` ambiguous errors (timeout, network or internal)
  **never** release the slug/operation; only definite Auth validation
  failures or confirmed Auth deletion can authorize terminal release.
- Server checks the Superadmin role within both Firestore transactions.
- A historical tenant with a slug missing from `tenantSlugs` prevents
  a new store using the same slug.
- New Store page persists only the opaque operation UUID per signed-in
  Superadmin in sessionStorage. After a lost response or reload, it
  shows a pending banner and modal action and blocks duplicate submission.
  Password/name/email are never persisted in local browser storage.
- Explicit status verification is allowed; no retry, Auth user creation,
  financial invoice issuance, subscription billing or hold release may
  happen during reconciliation.
- Only `failed_released` with strict absence proofs, or a definitive
  input error known to occur *before any mutation*, can reset the client
  operation UUID automatically. A definite 409 must also have
  server-confirmed `not_found` or `failed_released` before reset.

This closes **P1.2c** but does not claim acceptance of P1.2d payment
override/subscription changes, P1.2e financial M7 activation or a
signed-in live Production release. See dedicated acceptance:
`docs/LUKKAJA_P1_2_ATOMIC_OWNER_PROVISION_RECOVERY_20261123.md`.

## 2026-11-23 P1.2d — legacy subscription membership control (completed local module)

Firebase's legacy `updateTenantSubscription` now uses a checked
server-side transaction and immutable operation receipt rather
than optimistic UI state or repeated non-idempotent extension.
The Source-inspired card supports 30/365-day extension, exact
Bangkok expiry, manual suspend and separately confirmed
activate, but the package selector is locked until authentic
original pricing/billing terms are reviewed. A lost request
stays locked through navigation and is read back by a new
Superadmin-only operation Callable. No real financial Hold
can be released by a membership command.

Opening the Tenant list is now **strictly read-only**; historical
backfill and old-subscription automatic re-trial are disabled.
Firestore client writes to subscription/activation/access fields
and public slug activation are disallowed. The separate immutable
business/finance fields are not changed. Combined Auth/Firestore
Emulator and responsive React browser evidence, limitations and
Source SHA are documented in
`docs/LUKKAJA_P1_2_LEGACY_SUBSCRIPTION_ACCESS_CONTROL_20261123.md`.

## 2026-11-23 P1.2e — signed-hold evidence triage for Superadmin (read-only)

Added a new Superadmin-scoped, consistent Firestore read-only
Tenant+Slug evidence projection with separate classifications for
manual/security, subscription, historical Revenue Share, Hybrid
Billing, M7 hold metadata, missing original activation and TEST
override. The Source Go HMAC signer, bank journal, global claims and
credit ledger have **not** been migrated to Firebase: those
restrictions show as recorded metadata, never certified finance
hold or permission to reactivate selling.

`TenantControlPanel` now includes a lazily loaded and fully
responsive independent hold evidence panel inside the collapsed
Tenant details. All financial authority flags are false and
certified cash/invoice amounts remain null; there are no
activate/suspend/paid buttons in the report. The existing
module-access grid is labelled *according to recorded shop
data*, not as proof of operational access. A TEST allow metadata
cannot mask other recorded holds.

Security Rules prevent Browser writes to the additional M7
access/test-override flags, including Superadmin clients.
Source branch remains read-only and Production was not deployed.
See `docs/LUKKAJA_P1_2_TENANT_ACCESS_EVIDENCE_TRIAGE_20261123.md`
for the new contract, test coverage and original Go requirements.

## 2026-11-23 P1.2f — atomic master edit and Slug rename

The legacy Firebase `updateTenant` handler had a TOCTOU
race: a Slug was checked before a separate `WriteBatch`
that could overwrite another tenant's public Slug index.
It is now an alias to the strict
`updateTenantMasterAtomic` transaction with original
name/Slug/contact/business/revision CAS, a globally unique
new Slug, atomic old-Slug removal, Store Settings,
user/membership mirrors, and immutable operation receipt.
It never touches subscription signup dates, bank settings,
Owner identity, Service Credit, invoices or M7 access.

The existing Tenant edit UI now requires independent
operation/status/canonical Tenant rereads before showing
a success, and persists only the operation UUID if
transport fails. Recovering a pending operation is
read-only and never repeats the Slug rename.

Firestore Browser writes cannot forge master name/Slug/
business/revision and cannot access immutable master
receipts. The separate Tenant DELETE feature is
explicitly not part of this module and has its own
data-retention requirements.

See `docs/LUKKAJA_P1_2_ATOMIC_TENANT_MASTER_EDIT_20261123.md`.
