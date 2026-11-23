# P1.2f — Atomic Superadmin Tenant Master Edit and Slug Rename
**23 November 2026 · Complete local code module · React/Firebase target**

## Source, target, scope

| Attribute | Value |
|---|---|
| Source (strictly read-only) | `cosmatch/lukkhaja`, branch `feature/lukkaja_bankalert_stripe`, SHA `e60858c1` |
| Source pages | `resources/js/react-port/pages/AdminTenantsPage.jsx` and `resources/js/react-port/components/TenantControlPanel.jsx` |
| Target | `Natchanon45/food-order-app`, branch `feature/react-firebase-port` |
| Feature module | P1.2f Tenant master metadata **edit**, atomic Slug rename, contact and business propagation |
| Out of scope | Deletion/archival, new Owner creation, password changes, tenant activation, billing, payment, credit or production deployment |

The source exposes edit and delete actions in the Superadmin Tenant
directory. In the Firebase target, `tenant-admin.js.updateTenant`
previously checked a new Slug **outside** its final Firestore
`WriteBatch`, then used `batch.set` to overwrite the new
`tenantSlugs/{slug}` and delete the previous one. A concurrent
registration or another Superadmin edit could claim that Slug between
the initial read and the commit. The old write was also not
idempotent and had no canonical operation-reconciliation method,
while browser users could write some Tenant master fields directly.

This module replaces the insecure **edit** path with a server
transaction. It DOES NOT change the separate **delete** action,
which must undergo its own authorization/retention review before
being upgraded. Original financial ledger and external Source
contracts are left untouched.

## Implemented backend

### Strict input policy

`functions/tenant-master-edit-policy.js` defines exact typed
request, original-state projection, CAS, deterministic request
fingerprint and an immutable operation receipt.

All requests require the following fixed schema:

```text
{
  tenantId, operationId, name, slug, phone, address, businessType,
  expectedName, expectedSlug, expectedPhone, expectedAddress,
  expectedBusinessType, expectedRevision
}
```

- `operationId` must be a UUID (new for each independent edit).
- The new and original `slug` must be valid lowercase
  3–50-character route keys. They are **not silently sanitized
  by the server**; the browser normalizes before sending.
- `name` is 2–120 trimmed chars; phone 0–30, address 0–300,
  master business type is one of `both`, `restaurant_cafe`,
  `retail`; revision is a nonnegative safe integer.
- Unrequested fields such as `active`, `planCode`,
  `signupBilling`, `revenueShareSuspended`,
  owner credentials, payment flags, credit and M7 status
  cause a **definitive input rejection**, not an ignored write.
- The original name, Slug, contact values, master business
  type and revision are **all checked inside the transaction**.
  Stale UI copies, mismatched contacts or changed business
  metadata reject the full edit.
- For historical stores with no `masterEditRevision`,
  the expected revision is **0**; this is a version default,
  not an invented original activation or billing date.

### One atomic Firestore transaction

`functions/tenant-master-edit.js`

New callable:
`updateTenantMasterAtomic(request)`

The transaction checks authenticated active `super_admin`
on Firestore, original Tenant, old public Slug ownership,
new Slug uniqueness, store settings, matching Tenant users
and their memberships, then atomically writes:

1. Tenant `name`, `slug`, explicitly requested master
   `businessType` and `businessUnits` (only if changed),
   `masterEditRevision`, actor and update time.
2. Store Settings `shopName`, `shopPhone`,
   `shopAddress`; **does not overwrite bank or PromptPay**.
3. For a changed Slug, a **new public Slug document is created
   only if it is unclaimed**; the old canonical index is
   removed in the **same transaction**. Existing public
   index metadata (original Owner, provisioning ID,
   membership/access mirror, etc.) are preserved.
   Unchanged Slugs are updated in place without a delete.
4. Every matching user `tenantName`/`tenantSlug`
   and each existing membership mirror for that user.
   An absent membership, missing Owner, mismatched
   index or more than **80** users blocks the edit rather
   than leaving partial metadata updates.
5. An immutable, Admin SDK-only receipt at
   `tenants/{tenantId}/masterEditOperations/{operationId}`
   including prior/next master snapshot, user count, actor,
   deterministic request digest and explicit false
   finance/Owner/activation authority flags.

An identical operation replay returns the saved response;
a different payload with the same ID raises an operation
conflict. Two operations competing for the same original
revision cannot both commit. Two different stores racing
for the same newly free Slug cannot both own that Slug.

`tenant-admin.js.updateTenant` remains an exported legacy
Callable **alias** to the strict new atomic handler.
This prevents old clients from bypassing the new
transaction even if they call the earlier name. Existing
`createTenant` and `deleteTenant` are otherwise
unchanged in this module.

### Lost-response recovery

Read-only callable:
`getPlatformTenantMasterEditOperation({tenantId,operationId})`

The server independently rechecks the Superadmin role,
immutable receipt actor, Tenant revision, public Slug,
Store settings, users and memberships:

| Status | Interpretation |
|---|---|
| `complete_current` | Same master version and all canonical records agree |
| `complete_superseded` | The exact operation committed but a newer master revision exists |
| `review_required` | Record or distributed mirrors do not match; human review |
| `not_found` | No operation receipt found; may still be in flight, **do not automatically retry** |

The recovery handler does not update, create or delete any
Firestore document, call Auth mutations, reopen a shop or
mark a financial record Paid.

## Implemented React UX

Files:

- `react-app/src/data/tenantMasterEditRecovery.mjs`
- `react-app/src/components/TenantMasterEditRecoveryNotice.jsx`
- `react-app/src/ui/tenant-master-edit-recovery.css`
- `react-app/src/pages/AdminTenantsPage.jsx`

The existing Source-inspired Tenant edit form is retained,
including name, Slug, phone, address and master business
type. For an existing shop:

- Changing the Slug opens a confirmation that expressly
  warns that **the former URL will stop working**.
- Before submitting, a per-Superadmin/per-Tenant UUID is
  saved in sessionStorage. **Only the opaque UUID** is
  persisted, never email, store contacts, bank data or
  credentials. If storage is denied, **no edit is submitted**.
- The form is disabled while a write is in flight or its
  outcome remains unknown. There is no optimistic
  "saved" toast.
- A successful write requires three independently checked
  stages: (1) new atomic Callable response,
  (2) read-only operation receipt with current status,
  (3) a new `listTenants()` canonical reread that agrees
  on name, Slug, phone, address, master business and
  exact revision. Only then can the pending UUID be
  cleared and a success toast shown.
- A network timeout or failed follow-up leaves the UUID
  pending. Reopening the editor after navigation shows
  **"ตรวจสถานะคำสั่งเดิม"** and blocks new edits.
- A `complete_superseded` receipt is never replayed over
  another admin's newer change; the canonical newer data
  are shown instead.
- Empty phone/address values are respected as intentional
  clears rather than falling back to stale Tenant fields
  when settings provide an explicit empty string.

The **new Owner provisioning** flow stays on its previous
one-call, recoverable P1.2c path. The form uses no emoji.

## Firestore Rules / protection

- Tenant master keys `name`, `slug`,
  `businessType`, `businessUnits`,
  `masterEditRevision` and `masterEditedBy`
  are no longer directly mutable through Browser writes,
  even by a signed-in Superadmin.
- `masterEditOperations` is neither browser-readable nor
  browser-writable. Only Admin SDK can commit receipts.
- Canonical `tenantSlugs` already remains server-write-only.
- Tenant profile/Owner reads and other existing shop
  Settings interactions are not re-authorized by this Module.
- No real payment, original invoice or Source secret is
  read or written in this code path.

## Acceptance / automated tests

1. `tests/react-parity/p1-tenant-master-edit-policy.spec.mjs`:
   strict request allowlist and typed fields, original-state
   CAS, stored version, intentional contact clearing,
   legacy business-unit mapping, deterministic digests
   and immutable nonfinancial receipt.
2. `tests/react-parity/p1-tenant-master-edit-ui.spec.mjs`:
   exact UUID guard scoped to Superadmin and Tenant,
   blocked session storage, forged response detection,
   canonical reread, lost-response lock, old alias
   verification, and responsive Chrome test at 320,
   390, 768 and 1440 px.
3. `tests/firebase-emulator/p1-tenant-master-edit.spec.mjs`:
   Auth/Firestore demo, role denials, atomic Tenant +
   Settings + Slug + two user/membership mirrors,
   unchanged original billing/finance flags,
   eight parallel identical requests (one commit),
   concurrent different requests (one winner),
   two tenants racing for the same Slug (one winner),
   stale snapshots, foreign Slug, missing membership,
   blank contact fields, superseded receipt,
   historical Callable alias, direct browser
   Master field/receipt write denial.
4. Combined P1.2c, P1.2d, P1.2e, P1.2f Emulator
   regression, full `npm run test:react-parity`,
   Callable contract and React build.
5. JSX Source/Target inventory regenerated only after
   the commit to capture its correct committed SHA.

**Accepted boundaries:** local test and GitHub feature
branch only. No Production deploy, `main` merge,
Source edit, real database migration, M7 bank posting,
real tenant deletion, financial suspension or billing
activation occurred as part of this Module.

## Deferred

The old `deleteTenant` path still uses its separate
legacy deletion policy, not this mutation contract.
Do not assume this Module certifies safe store deletion
or makes financial M7 ledgers operational.

Any future production deployment should separately
validate old public URL consumers, the new Admin SDK
write paths, occupied Slug reservations, owner/membership
fanout above the 80-user cap, and transaction retention/
recovery in a signed-in non-production environment.

## Final local acceptance evidence

- **12/12** new Firebase Auth/Firestore Emulator tests for P1.2f,
  covering cross-tenant simultaneous Slug claims, idempotent
  repeated calls, stale CAS, user/membership integrity and
  rejected direct browser writes.
- **51/51** combined P1.2c/d/e/f Firebase Auth/Firestore
  Emulator tests; no mutation to Production resources.
- **8/8** new pure master-edit policy tests and **8/8**
  React/Chrome contract/browser tests; responsive 320, 390,
  768 and 1440 px.
- React Callable Contract: **119 references, 0 missing**.
- React Vite production build + hosting-generated build
  contract: **PASS**, not deployed.
- Browser test verified only one explicit check action after
  ambiguous write, with the save action disabled.
- Original LUKKAJA Source branch remains unmodified.

These tests certify the **local feature implementation**,
not live Production UAT, data deletion or an operational
M7 settlement system.
