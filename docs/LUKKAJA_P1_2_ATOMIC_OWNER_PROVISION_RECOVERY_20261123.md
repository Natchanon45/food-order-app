# P1.2c — Superadmin creates a store + Owner, verifies outcome, recovers from ambiguity
**23 Nov 2026, Source read-only / Firebase target only**

- Source: `cosmatch/lukkhaja`,
  `feature/lukkaja_bankalert_stripe@e60858c1`.
- Target: `Natchanon45/food-order-app`,
  `feature/react-firebase-port`.
- **Module scope**: real single logical new-store + Owner provisioning,
  original membership start, network-safe status reconciliation.
- **Not in scope**: historical financial balances, new invoice issuers,
  Provider bank verification, Service Credit, automatic suspensions,
  Email-delivery proof, Production deployment, main branch merge.

## What the Source does

Source `AdminTenantsPage.jsx` has one New Store form containing:
Store identity, Owner name/email/password confirmation, and monthly/yearly
plan. Source Go backend combines shop+Owner activation and rejects orphaned
or duplicated creation. Firebase already had an idempotent Callable with
transactional slug reservation and compensating Firebase Auth deletion,
but browser recovery of an ambiguous Create operation was only a vague
"reload and inspect". The previous backend also treated **all**
`auth.createUser` errors as proof the user was not created — incorrect
for network/provider timeouts after a successful Auth commit.

## Implemented single-module lifecycle

1. Superadmin must have a server-side role/profile; owner/cashier/
   inactive actors cannot call the one-step provisioning API.
2. The Create form carries a v4-style `operationId`. Only this
   opaque UUID is persisted in sessionStorage, under the exact Firebase
   Superadmin UID, immediately **before** network submission. If
   browser storage is unavailable, the write is blocked.
3. The server verifies platform subscription pricing and rejects
   historical slug collisions (even if a legacy tenant predates
   `tenantSlugs`). A Firestore transaction reserves both
   operation UUID and public slug, rechecking Superadmin role.
4. Firebase Auth creates Owner with `emailVerified:false` (never
   fake a confirmed email). A second transaction creates Tenant,
   Store Settings, Owner Profile, membership, and updates the
   public slug+operation to complete, rechecking privileges.
   Trial starts only at the first actual activation:
   monthly one free month; yearly one free month plus 12 paid
   membership months. No backdated or retroactive invoice is issued.
5. If Auth returned a **definite reject** (duplicate email or invalid
   email/password), the operation may be released after confirming
   no tenant was committed. If Auth creation outcome is ambiguous,
   retain reservation as `pending_review` and **never** silently
   create a second account or free the slug. If Auth was created
   and Firestore failed, delete Auth only after confirming the
   operation is still uncommitted; release only on confirmed deletion.
6. After a successful Create HTTP response the UI asks the new
   `getPlatformTenantProvisionStatus` read-only Callable to check:
   original operation/creator, exact slug, Tenant, Owner Profile,
   membership, Store Settings, native Firebase Auth UID/email/name
   and unchanged original activation/plan. It then independently
   re-reads the canonical tenant listing.
7. A network error, ambiguous response or reload keeps the opaque
   operation ID and disables another Create. The UI shows a
   responsive banner (and modal reminder) with the server-only
   **"ตรวจสถานะคำขอเดิม"** action. It reads status; it never
   automatically resends Auth/Firestore writes.
8. `complete_verified` + canonical re-read releases the local
   operation lock. `failed_released` only releases after terminal
   server compensation and zero owned slug/tenant records.
   `not_found`, `pending_review`, `review_required`,
   mismatched Auth identity or incomplete data require human review.
9. Firestore Rules deny client reads/writes to
   `platformTenantProvisions/{operationId}` even from a Superadmin
   browser; status is exposed only through the scoped Callable.
10. None of the checks make an invoice, credit, bank receipt,
    subscription payment, access hold or email-verification claim.

**Important**: Firebase Auth + Firestore cannot be a true distributed
ACID transaction. The idempotent operation and compensating rollback
are necessary, and ambiguous provider outcomes intentionally remain
locked for human recovery. The code is *not* permitted to auto-delete
an unknown Auth account or release a potentially claimed slug.

## New Firebase contract

```text
createActiveTenantWithOwner({...fields,operationId})
getPlatformTenantProvisionStatus({operationId})
  → {
    ok:true,operationId,status,readOnly:true,
    tenantActivated,ownerConfigured,
    canIssueInvoice:false,canSettleMoney:false,canReleaseTenant:false,
    mayRetryWithNewOperationId:false|true,
    tenant:null|{id,name,slug,planCode},
    owner:null|{uid,role:"owner"},reason
    }
```

The status values are:
- `complete_verified`: Auth + all relevant Firestore records agree;
  not permission to invoice.
- `pending_review`: operation reserved; commit/rollback may be in
  progress or outcome may be unknown. Never issue another write.
- `failed_released`: documented compensation completed with no
  owned tenant or slug remaining. Fresh operation may be attempted.
- `review_required`: inconsistent Auth/Firestore/old status; locked
  for direct Superadmin investigation.
- `not_found`: no operation record at instant of query; **not**
  proof that an in-flight original request will never arrive.

## Acceptance cases

```text
tests/firebase-emulator/p1-tenant-provision-reconcile.spec.mjs
tests/react-parity/p1-tenant-provision-recovery.spec.mjs
```

Emulator cases: authorization (including inactive, other Superadmin),
missing operation, correct one-call signup with original calendar,
idempotent replay, Auth and membership tampering, disabled native
Owner, duplicate Auth email compensation, ambiguous reserved hold,
wrong release proof, five same-UUID concurrent callers, four
same-slug different-UUID callers, Source legacy slug missing index,
Superadmin Firestore client denial.

React parity/browser: operation key isolation across logins,
storage unavailable fail-closed, strict response shape and false-money
flags, canonical independent re-read, unknown vs definitive failures,
Source JSX three-step form/Callable integration, single recovery action
and layout across **320, 390, 768, 1440px**.

## Remaining whole-system work

P1.2c code and isolated acceptance are complete when the tests,
full project regression, and GitHub branch commit pass. This does
**not** finish all P1.2 Tenant Workspace functionality. In particular:
signed-in Production Superadmin click-through and Email provider
verification are not demonstrated by local Emulator/Browser tests.
Financial M7 issuance, holds and Service Credit remain separately
gated. No Production deployment is authorized in this module.

## Final local module regression evidence

| Test/check | Observed outcome |
|---|---|
| `tests/firebase-emulator/p1-tenant-provision-reconcile.spec.mjs` | **10/10 PASS**, Firebase Auth + Firestore demo |
| Earlier atomic new owner and onboarding Emulator test modules run together | **16/16 PASS** |
| `npm run test:tenant-provision-recovery` | **7/7 PASS** |
| Chrome browser UX/visual bounds | **320/390/768/1440 px PASS** |
| `npm run test:react-parity` existing full project regression | **PASS** |
| Current dynamic Callable references | **115 references, no missing exports** |
| React Vite bundle and generated hosting contract | **PASS** |
| Original LUKKAJA Source branch | **READ ONLY** |
| Live Firebase Production publish and real Auth email sign-in | **NOT PERFORMED** |
