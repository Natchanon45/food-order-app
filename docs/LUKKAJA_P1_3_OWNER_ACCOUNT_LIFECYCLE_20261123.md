# P1.3c — Owner Account Lifecycle: Existing Tenant attach / rename

**Date:** 2026-11-23 (Asia/Bangkok)
**Target:** `Natchanon45/food-order-app`, `feature/react-firebase-port`.
**Source read-only:** `cosmatch/lukkhaja`, `feature/lukkaja_bankalert_stripe@8b108f1`.
**Status:** Feature code and isolated tests complete locally; signed Production provider UAT and Production deployment are NOT authorized.

## Objective and preserved Source UI

Preserve the LUKKAJA **PlatformOwnersPage** JSX layout, modern modal, Superadmin search/status filters and create/edit actions while implementing Owner identity operations entirely against PENGUIN Firebase Cloud Functions, native Firebase Auth and canonical Firestore Tenant/member records. No Laravel, Go API or live LUKKAJA data is used.

The earlier `createTenantOwner` created Auth before reserving the Tenant, followed by a non-idempotent multi-document batch. An ambiguous Firestore result could leave the Auth identity created but a Tenant unlinked. The earlier `updateTenantOwner` also edited native Auth before Firestore with no durable CAS/recovery. Both old callable names now alias the **strictly guarded server implementation**; legacy requests without an operation UUID/expected snapshot are rejected rather than silently bypassing safety.

## 1. Server operations and data invariants

| Callable | Action / guard | Result |
| --- | --- | --- |
| `createTenantOwner` | Typed Tenant ID, UUID, expected slug/name/master revision, onboarding flag, explicit plan for never-activated shop, email/password and intended Owner displayName | Durable reservation; native Auth create; transactional Tenant+profile+membership+slug finalize |
| `updateTenantOwner` | Typed Tenant ID, UUID, immutable Owner UID, expected Owner revision and expected current displayName | Native Auth proof, per-tenant serialization and CAS rename; finalize both Firestore mirror records + Tenant name only |
| `getPlatformTenantOwnerOperation` | Tenant ID + original UUID, active Superadmin, **same actor** as original operation | **Read-only** verification from receipt, Tenant, slug, Firestore user/membership, native Auth and billing snapshot |
| `listTenants` | Existing authorized source-equivalent list, including Owner revision | Used as independent canonical read before Browser shows success |

Firestore Admin SDK-only paths:

```text
tenants/{tenantId}/ownerAccountOperations/{operationId}
tenants/{tenantId}/ownerAccountLocks/current
ownerEmailReservations/{sha256(lowercaseEmail)}
users/{ownerUid}
tenants/{tenantId}/memberships/{ownerUid}
tenantSlugs/{canonicalSlug}
Firebase Auth users/{ownerUid}
```

The three operation/lock/email claim collections are **read/write forbidden to every browser** including Superadmin, by Firestore Rules. The SHA-256 email key supports cross-tenant create serialization without exposing email in the collection path. The operation document and status response **never contain the password**.

### Owner attach (Pseudocode 1)

1. Authenticate an active Superadmin; validate exact typed request, UUID, email/username, password and expected Tenant snapshot.
2. New placeholder: require `active:false`, `onboardingRequired:true`, no prior `firstActivatedAt`/trial/plan/signupBilling or financial activation markers, and configured valid central subscription pricing. Existing ownerless active tenant: require existing valid activation/trial/term and preserve it; a historical missing `onboardingRequired` field is treated as **not new**, never as a reason to start another trial.
3. Firestore transaction validates Tenant, slug registry, settings/store, existing owner records, master revision, current Owner absence and lock/email claims. Reserve immutable operation UUID, Tenant lock and global email claim.
4. Create Firebase Auth user with deterministic UID derived from the UUID, `emailVerified:false`, disabled false. A timeout/unknown Auth result **leaves reservations locked**.
5. Firestore transaction rechecks reservation/tenant/slug/original billing fingerprint, creates user and tenant membership, assigns Owner UID/email/name and revision, finalizes slug + operation, and removes Tenant lock. **Never auto-delete Auth if Firestore commit is unknown**.
6. For the never-activated placeholder only, start `firstActivatedAt=trialStartsAt=now`, call the canonical Bangkok `onboardingDates()` once and record selected plan, expiry and signupBilling. For an **already-activated ownerless Tenant**, do not write any subscription/financial fields.
7. A definitive rejected Auth create plus independently confirmed absent deterministic UID / Firestore records permits `failed_released`. All other uncertainty remains `review_required` / `pending_review`, not silently retried.

### Owner rename / edit (Pseudocode 2)

1. Authenticate active Superadmin; validate current canonical Owner UID, Tenant, Firestore profile+membership, role/active, exact original displayName and `ownerRevision` CAS.
2. Independently verify native Auth UID/email/enabled/displayName **before** reserving the operation.
3. Reserve per-Tenant operation and update lock transactionally.
4. Update Auth displayName; transactionally update both Firestore mirrors, `ownerDisplayName`, increment `ownerRevision`, mark receipt complete and remove lock.
5. Status is `complete_verified` only if Owner, Tenant, Slug, receipt, both mirrors and native Auth agree **and** the original subscription/billing digest is unchanged. Unknown edit results stay pending for a human review; no automatic rollbacks.

### Read-only status (Pseudocode 3)

- `complete_verified`: all canonical and native proofs match, current Owner revision and billing fingerprint unchanged.
- `pending_review`: legitimate reserved operation with no verified completion, still may be in flight; never auto-retry.
- `review_required`: missing/partial native Auth, Firestore, receipt, ownership or billing proof; manual investigation required.
- `failed_released`: only a definite Auth rejection with confirmed absence and safely cleared reservations; a fresh command may be submitted.
- `not_found`: missing receipt, **never** treated as proof that the previous command cannot arrive.

The response is scoped to the exact acting Superadmin. It never certifies bank deposits, invoice settlement, sent email, or changed subscription rights.

## 2. Browser and UI preservation

- A per-Superadmin/per-Tenant `sessionStorage` entry stores only an opaque UUID. No email, password, Owner name, bank credentials, or request body persist.
- A compact recovery card is shown independently of list filters so pending operations are always visible. Creating/renaming the same Tenant is disabled until original status is independently checked.
- `complete_verified` is still insufficient alone: Browser re-requests `listTenants` and checks exact `ownerUid`, `ownerDisplayName`, `ownerRevision`, and the absence of pending onboarding before clearing the UUID.
- A verified `failed_released` unlocks; `pending_review`, `review_required`, `not_found`, offline status, corrupt/disabled session storage or unexpected server response all fail closed.
- Creating an Owner requires an explicit monthly/yearly plan **only for a never-activated placeholder**. Renaming does not change email/password or any financial/subscription field.
- Existing Source-aligned layout/modal/actions remain; the security notice is intentionally new and responsive. No email invitation is claimed.

## 3. Evidence and acceptance

| Scenario group | Current evidence |
| --- | --- |
| Strict create/edit/status validation, owner scope, expiry/financial immutability | Node policy suite PASS |
| UUID-only session storage, canonical proof, unknown status and UI gate | Node / Chrome suite PASS |
| Real PlatformOwnersPage in isolated Chrome, lost Create reply → reload → status, rename and lost Rename reply → recovery | Mobile 390 px + Desktop 1440 px PASS |
| Recovery notice layout | Chrome 320 / 390 / 768 / 1440 px PASS |
| Auth+Firestore Emulator: placeholder activation once, legacy active ownerless attach without billing mutation, owner rename revision/CAS, concurrent claims, definitive Auth denial, pending/partial and cross-actor denial | PASS |
| Existing P1 onboarding regression and P1.3b Staff Auth lifecycle with updated Callable aliases/Rules | PASS |
| Combined Auth/Firestore Emulator release suite | **25/25 PASS** |
| Dedicated owner Node+Chrome suite | **11/11 PASS** |
| Whole React Parity and React Build | final results in Worklog |
| Actual Production email invitation, native mobile pairing, signed browser UAT | NOT PERFORMED |
| Production Firebase Hosting/Functions/Rules deploy, merge `main` | NOT PERFORMED |

**Limits / manual recovery:** The application deliberately never automatically repairs or deletes a partially created Firebase Auth owner, nor reissues an uncertain operation. Operations with incomplete provider evidence must be manually investigated. Backwards-incompatible old unversioned Caller requests are blocked and require the revised Browser bundle + Functions to be deployed together in a future authorized release.

## 4. Next Module

**P1.3d — Provider-backed email verification/invitation and authenticated Browser UAT.** Verify actual Auth email issuance/delivery, registered Owner onboarding and new Staff invitation flow through their proper providers, then sign off the P1.3 pages and Firebase Rules/Functions rollout. Production remains blocked until explicitly approved.
