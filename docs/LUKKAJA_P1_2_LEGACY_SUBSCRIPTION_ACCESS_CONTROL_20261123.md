# P1.2d — Legacy subscription and Superadmin membership/access control
**23 Nov 2026 · single completed code Module · Target Firebase port**

## Scope and lineage

- **Source (strictly read-only):** `cosmatch/lukkhaja`,
  branch `feature/lukkaja_bankalert_stripe`,
  commit `e60858c1`, source
  `resources/js/react-port/pages/AdminTenantsPage.jsx`
  and its Subscription UI/Go-adapter contract.
- **Target:** `Natchanon45/food-order-app` /
  `feature/react-firebase-port`.
- **In scope:** Superadmin-controlled **legacy non-financial**
  monthly/yearly subscription extension, expiry change, manual
  suspension/re-activation; strict server checks; immutable action
  receipts, idempotency and reconciliation of lost responses;
  synchronized canonical Tenant/Slug and browser display.
- **Out of scope:** retroactive charges, automatic M7 invoices,
  Stripe/Slip2Go/bank proof, Service Credit, changing historical
  billing plan, unauthorized financial hold release, Production
  deployment, iOS/Android store releases, direct signed-in Prod UAT.

## Why this module was necessary

The Firebase target previously sent `updateTenantSubscription` directly
without an operation ID or an expected original state, then **optimistically**
manufactured the updated tenant in React. Repeating a 30/365-day
extension after an ambiguous network error could extend twice.
A Number input used permissive server-side clamping (NaN/large number),
and `set-expiry` used server-local 23:59 rather than a fixed Bangkok
calendar day. The Tenant page also invoked an unreviewed historical
`backfillTenantSubscriptions` **on load**, potentially starting a
new trial for a historical merchant missing membership dates.
Those properties were incompatible with Source strict expiry/CAS
checks and with "old test shops, no retroactive charges".

## Implemented backend contract

**Callable**
`updateTenantSubscription({tenantId,operationId,action,days,
 expiresAt,gracePeriodDays,planCode,expectedExpiresAt,
 expectedStatus,expectedActive,expectedRevision,
 expectedGracePeriodDays,expectedPlanCode})`.

Before the write, the server verifies a live, active `super_admin`
role, strict typed input and original membership. The Firestore
transaction rechecks that role and reads Tenant, the immutable
operation receipt, and canonical `tenantSlugs/{slug}`; only matching
indexes are accepted.

For a **new** operation, all of the following commit atomically:
Tenant subscription patch, matching public slug subscription fields,
and `tenants/{tenantId}/subscriptionAdminActions/{operationId}`
with immutable prior-state summary, result, actor, request digest
and revision. Receipt replay uses the same original operation ID
and fingerprint and cannot extend twice. A different payload
reusing an operation ID fails.

The new read-only
`getPlatformTenantSubscriptionOperation({tenantId,operationId})`
returns `not_found`, `review_required`,
`complete_current`, or `complete_superseded`. It cross-checks
the actor's role, own operation, Tenant and public Slug, with no
bank or financial permission fields true. It **never** reissues an
extension or changes an invoice.

The policy only changes subscription status, expiry, grace,
active and manual subscription suspension reason/revision.
It NEVER modifies `firstActivatedAt`, trial history,
`subscriptionStartedAt`, signup original terms,
invoice/credit/bank/Delivery data, M7 invoice hold, or
Revenue Share suspensions.

### Supported actions

| Action | Behavior |
|---|---|
| `extend` 30/365 | Strict fixed integer days; CAS using original expiry/status/grace/plan/active/revision. A suspended tenant **remains suspended**, requiring a separate activation. Missing original expiry cannot be silently reset to today |
| `set-expiry` | Strict Gregorian YYYY-MM-DD, including leap dates; end-of-day at **23:59:59.999 Asia/Bangkok**. Never use the browser/server's local time zone |
| `suspend` | Separate manual status and reason, requiring Superadmin. Cannot overwrite an independent security/financial restriction |
| `activate` | Only removes an explicit, known **manual subscription** hold. It cannot release a Revenue Share, Hybrid, M7 overdue-invoice or unknown security hold. If expired, it remains expired until a valid independent extension |

The monthly/yearly package selector remains **read-only** in this
module because silently switching the source financial terms would
require separate original-price evidence and billing reconciliation.

### Historical data and scheduler

Opening Admin Tenants now **only reads** the tenant list; no
`backfillTenantSubscriptions()` call occurs on page mount.
The legacy backfill Callable fails closed until original signup
evidence can be reviewed, rather than granting a trial from
the present day. Even the on-create subscription trigger is now
diagnostic-only for records without an authenticated initial cycle;
an original one-month free trial must come from the explicit
new-owner or self-registration flow. The 00:15 local legacy
scheduler still synchronizes dated statuses in an atomic
Tenant+Slug transaction, but skips records without a verified
expiry/index and respects independent holds. It
does **not** start M7 00:00/00:20 invoice/finance jobs.

### Frontend / safety

`TenantSubscriptionControl.jsx` mirrors Source's three informational
fields, grace/expiry/plan layout, and actions while keeping the
original PENGUIN TenantControlPanel, badges, collapse and Server
toasts. On manual suspend/activate, the UI requires confirmation.

The browser stores **only an opaque operation ID** in sessionStorage
under the signed-in Superadmin UID and Tenant ID *before* submission.
It then checks (a) the Callable response, (b) an independent
server-only operation status, and (c) independently reread
`listTenants` before claiming completion.

If a network response could have been committed, a retry
must not send another write. The responsive card shows
"ตรวจสถานะคำสั่งเดิม" (read-only), and all mutation controls
stay disabled. A committed-but-superseded operation is not
replayed over newer data; the latest canonical tenant is shown.

Firestore Rules forbid even the Superadmin browser from
reading/writing immutable `subscriptionAdminActions` and
from directly updating subscription/activation/access fields on
a Tenant. `tenantSlugs` canonical updates are now server-only;
remaining nonfinancial tenant profile edits still have the
previous Superadmin permission.

## Explicit omissions

- No provider email confirmation or real bank/receipt evidence.
- No auto-issue invoice, verified payment state, credit or M7 release.
- No backdating old test stores, resets of their original signup date,
  renewal based on fabricated legacy dates or automatic trial on page load.
- No production deploy, no `main` merge and no Source change.
- This is **P1.2d legacy subscription controls**, not acceptance of all
  finance, hybrid membership or full P1.2 tenancy/UAT.

## Acceptance

Tests implemented:
- `tests/react-parity/p1-tenant-subscription-policy.spec.mjs`
  — pure strict validation, Bangkok calendar, source immutability,
  duplicate extension avoidance, independent hold behavior.
- `tests/react-parity/p1-tenant-subscription-control.spec.mjs`
  — session guard, response strictness, canonical re-read, browser
  component interactions at **320/390/768/1440 px** with no overflow.
- `tests/firebase-emulator/p1-tenant-subscription-control.spec.mjs`
  — Firestore/Auth Emulator: role denials, original membership,
  atomic public slug+tenant+immutable receipt, idempotent
  five-request same-ID concurrent calls, two different IDs for
  stale state, expired/suspend/activate/M7 hold,
  direct Browser Firestore denial.
- Combined regression against P1.2c Atomic Owner and previous
  onboarding modules, full React parity, Callable contract,
  JSX physical LOC audit and React build contract.

**Current evidence:** local **28/28** combined Firebase Emulator tests
(including P1.2c and the 00:15 scheduler transaction),
11/11 pure policy and 8/8 browser/client tests.
The final full project regression, JSX snapshot and GitHub SHA are
recorded in the Port Phase Tracker after acceptance. No
Production credentials or real financial transfers were exercised.


## Final local acceptance gate

- **28/28** combined Firebase Auth + Firestore Emulator: P1.2d plus
  P1.2c Owner and original onboarding regression, including scheduler
  tenant/slug atomic update and direct client Security Rules rejection.
- **11/11** pure subscription policy tests: strict CAS/validation,
  Bangkok calendar, historical expiry and independent finance holds.
- **8/8** React browser/contract tests, including interactive Chrome
  widths 320/390/768/1440 px and no horizontal overflow.
- **PASS** complete `npm run test:react-parity`, existing routes,
  finance/Delivery/POS and all P1.2 dependencies.
- **116 Callable references / 0 missing exports**.
- **PASS** `npm run build:react` and generated-hosting contract;
  generated public assets not staged or deployed.
- Static Node syntax and `git diff --check` pass. No Source edits,
  no Firebase Production deploy and no merge to main.

## Latest source-vs-target JSX receipt

Source `e60858c1` = **156 files / 48,954 JSX lines**.
Target P1.2d feature commit `60902489` = **107 files /
37,493 JSX lines**, broken down into 52 page JSX / 30,263,
49 component JSX / 6,440 and six other JSX / 790 lines.
The source `AdminTenantsPage.jsx` remains 2,275 lines;
Target `AdminTenantsPage.jsx` is 1,708 lines plus the new
166-line `TenantSubscriptionControl.jsx`. This is not evidence
that finance/M7 SQL business workflows have been migrated.
