# P1.2g — Safe Tenant Deletion (Superadmin, empty placeholders only)

**Completed local development: 23 November 2026**

## Source and destination

| Field | Value |
|---|---|
| Source | `cosmatch/lukkhaja` `feature/lukkaja_bankalert_stripe` at `18093091`; strictly read-only |
| Target | `Natchanon45/food-order-app` `feature/react-firebase-port` |
| Original Source React | `resources/js/react-port/pages/AdminTenantsPage.jsx`, `TenantControlPanel.jsx` |
| Target React | `react-app/src/pages/AdminTenantsPage.jsx`, `TenantControlPanel.jsx` |
| Boundary | A single **never-activated, never-owned, empty draft Tenant** with its lone Store Settings document and original Slug |
| Deliberate exclusions | Active/Owner-created shops, orders, memberships, invoices, financial history, receipts, credits, external claims, production rollout |

### Fixed defect and safety policy

The existing Firebase Target `tenant-admin.deleteTenant` checked
only a fixed list of ten child collections, then deleted the public
Slug separately and called `db.recursiveDelete(tenantRef)`.
It could miss a newly introduced subcollection or financial history,
leave orphaned/foreign Slug data, or delete a tenant with an Owner
and Auth identity. It had no per-operation receipt and could not
independently reconcile a timeout.

**That implementation has been removed.**

The new deletion is allowed **only** for original legacy draft
placeholders created by the source-aligned
`tenant-admin.createTenant` flow, where:
- Tenant is `active:false` and `onboardingRequired:true`.
- It has **never had** an Owner, original trial, paid membership,
  subscription terms, payment, Revenue Share or M7 state.
- Tenant metadata is restricted to the original draft-shaped
  allowlist. Any unknown future field is considered protected
  and fails closed.
- The only permitted child collection is `settings` with
  precisely one document named `store`, containing only
  original nonfinancial fields.
- Public `tenantSlugs/{slug}` exactly matches Tenant identity,
  name, inactive status, no Owner and no provisioning ID.
- No tenant-owned document exists in separately named
  identity, registration, finance, companion, Stripe TEST,
  Lalamove or notification external collections.
- The exact original name, Slug and `masterEditRevision`
  match the Superadmin's chosen record.
- Anything missing, unfamiliar, divergent, protected or
  unavailable refuses deletion; **no administrative force mode**.

A tenant created and activated by P1.2c, or any historical
Shop with an Owner, cannot be hard-deleted by this API.

## Backend

`functions/tenant-safe-deletion-policy.js` implements strict
bounded command/selector allowlists, immutable reason codes,
original-state CAS and financial-denial flags.

`functions/tenant-safe-deletion.js` exposes:

1. `getPlatformTenantDeletionSafety({tenantId})`: independent,
   active Superadmin-only **read-only** preflight. It returns
   `ready` and explicit rejection reasons; it never
   exposes shop bank account details or financial balances.
2. `deleteTenant({tenantId,operationId,expectedName,
   expectedSlug,expectedRevision,intent:"delete_unowned_placeholder"})`:
   strict active Superadmin; actual **Firestore transaction**
   reads the original Tenant, Slug, Store Settings,
   external collection references and immutable receipt /
   tombstone before writing.
   - Deletes only `settings/store`, exact matching
     `tenantSlugs/{slug}` and the unowned draft Tenant.
   - Creates immutable receipt
     `platformTenantDeletions/{operationId}` and durable
     `platformTenantDeletionTombstones/{tenantId}`.
   - An identical duplicate UUID returns the original
     result. A different UUID cannot delete the same Tenant
     twice; conflicting requests reject.
   - Does **not** call `recursiveDelete`, delete Auth users,
     touch Owner accounts or write financial state.
3. `getPlatformTenantDeletionStatus({tenantId,operationId})`:
   read-only scoped operation lookup. The same authenticated
   Superadmin actor must match the receipt; the handler
   independently checks Tenant absence, tombstone and
   that the original Slug is not still owned by the
   deleted Tenant. Results are `deleted_verified`,
   `review_required` or `not_found`; no automatic retry.

The legacy `tenant-admin.deleteTenant` export is retained as
an alias to the strict handler so older clients **cannot**
bypass the new checks with a `{tenantId}` request.

### Firestore Security Rules

- Browser `delete` on `tenants/{tenantId}` is **denied**,
  including for signed-in Superadmins. The Callable uses
  trusted Admin SDK transaction writes.
- Slug writes were already Admin-SDK-only.
- Global receipt and tombstone collections are
  **browser read/write denied** (including Superadmin).
- Browser updates to a Tenant's root document are restricted
  to `description`, `logoUrl`, `coverUrl` and `updatedAt`
  for authorized Superadmins. This **allowlist**, rather than
  an open-ended list of prohibited finance fields, prevents
  client removal of future unknown bank/Owner/financial
  metadata to manufacture an empty draft. Operational
  mutations remain trusted-server-only.
- Existing ordinary create permissions are not broadened.

## Superadmin UX

The existing Delete action is retained with a safer flow:
- Preflight checks the selected Tenant. If not ready, it
  explains why (Owner, financial provenance, child
  records, unknown metadata, invalid Slug, etc.) and
  **does not open a confirmation or submit a deletion**.
- Only a verified empty placeholder receives a clear
  destructive confirmation warning it is permanent and
  releases the old public Slug.
- Before sending, the browser saves a UUID and Tenant ID
  to sessionStorage under a per-Superadmin key.
  No name, address, email, bank account, credentials or
  financial data are persisted there.
- After a returned write, the browser verifies **both**
  the read-only operation receipt and a newly fetched
  canonical Tenant list that no longer includes the ID
  before showing success or clearing the pending record.
- If a write times out or cannot be independently
  confirmed, the pending record **survives navigation**.
  A visible read-only recovery card offers one
  `ตรวจสถานะคำสั่งเดิม` action. It cannot issue a
  fresh destructive command while unresolved.
- A pending Owner-provision, master-edit or membership
  operation for the same shop also blocks deletion.
- The recovery component is responsive at 320, 390,
  768 and 1440 px. No emoji are used in the web UI.

## Local acceptance / executable tests

- `tests/react-parity/p1-tenant-safe-deletion-policy.spec.mjs`
  validates exact command types, untouched Owner/finance,
  strict metadata allowlists, unknown future fields,
  cross-tenant Slug and immutable receipts.
- `tests/react-parity/p1-tenant-safe-deletion-ui.spec.mjs`
  validates session UUID lock, forged responses,
  independent status/canonical reread, fail-closed
  unknown errors, original Callable alias, and
  interactive Chrome responsiveness.
- `tests/firebase-emulator/p1-tenant-safe-deletion.spec.mjs`
  verifies active Superadmin authentication, actual
  atomic deletion of an eligible draft, eight concurrent
  duplicate requests and two racing operation IDs,
  stale CAS, foreign Slug, activated/Owner-linked stores,
  unknown future child collections, unknown bank fields,
  global User/provision references, Slug reassignment,
  and Firestore Rules denial of direct Browser deletion.
- Regression includes P1.2c Owner provisioning,
  P1.2d subscription control, P1.2e financial
  evidence triage and P1.2f atomic master edits.

**Observed local tests: 14/14 dedicated Firebase Auth +
Firestore Emulator; 65/65 combined P1.2c–P1.2g Emulator;
10/10 pure policy and 7/7 React UI/contract tests;
full React parity, 121 Callable references / zero
missing exports, and Vite React Build/hosting contract PASS.**

## Explicit limitations

This intentionally does not provide "force delete" for
provisioned shops: their Auth identity, invoices,
financial claims, Service Credit, daily Revenue Share,
journal history and memberships must remain intact.

Firestore does not offer an atomic query across all
possible future subcollections and all external systems.
This code fails closed for any child collection or
document it can observe and for unexpected tenant/store
fields. An out-of-band **Admin SDK writer creating an
entirely new subcollection between enumeration and
transaction commit** is not covered by a global
writer lock; operational deployments must restrict
such writers for drafts or introduce an authoritative
deletion lock checked by every producer. Neither
this module nor its tests certify deletion under
arbitrary external writer activity.

There is no migration, Firebase Production deploy,
APK build, Merge into `main`, Source mutation,
real payment settlement or Owner deletion in this module.

### Post-hardening verification

The browser-side delete protection additionally blocks rewriting
`ownerUid`, `ownerEmail`, `ownerDisplayName`,
`onboardingRequired`, `signupBilling` or `createdBy`
to simulate a never-owned draft. All 14 dedicated Firebase
Auth+Firestore Emulator tests passed with the final Rules, and
the 65-test combined suite reported 65 passing assertions.
The combined runner encountered a transient Emulator
securityRules endpoint error while shutting down in one
verification run (after all 65 tests passed); the dedicated
final-Rules run completed cleanly with exit code 0.

During the module, Source independently advanced to
`18093091` to preserve LK Shop Android APK downloads across
LUKKAJA UAT deployments. This was not an edit by this module.
That commit touched deployment/docs/tests, not Source JSX.
