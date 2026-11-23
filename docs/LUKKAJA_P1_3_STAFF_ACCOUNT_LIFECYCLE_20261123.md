# P1.3b — Staff Account Lifecycle / Firebase identity and recovery

**Development date:** 2026-11-23, Asia/Bangkok
**Target:** `Natchanon45/food-order-app`, `feature/react-firebase-port`.
**Pinned Source for comparison (read only):** `cosmatch/lukkhaja`, `feature/lukkaja_bankalert_stripe@8b108f1`.
**Status:** Local backend + browser module implemented and regression-tested. **No Firebase Production deployment or real email delivery.**

## 1. Scope and parity

The LUKKAJA `AdminUsersPage.jsx` page has the staff list, staff add form, role/scope edits and active switch. Its Go identity endpoint cannot be imported to Firebase. The existing PENGUIN counterpart already retained Source JSX and the owner-only page layout but used simple `createTenantStaff` / `updateTenantStaff` Callables with separate Auth and Firestore writes, so a lost response could leave a real Auth account with an unknown Firestore state or allow accidental repeated submission.

This module changes **only Firebase staff identity operations**, retaining Source page design, PENGUIN roles, existing staff controls, and canonical Tenant membership. It does not alter Owner creation, onboarding dates, subscription plans, invoices, payment verification, any historical tenant metadata, or source Go APIs.

## 2. Trusted server contract

- `listTenantStaff({expectedTenantId})`: active signed-in **Owner**, exact canonical tenant ownership and enabled Firebase Auth identity; returns only staff projections including a nonnegative `staffRevision`. Missing/foreign tenant fails closed.
- `createTenantStaff({expectedTenantId,operationId,displayName,email,password,role,businessScope,active})`: strictly typed allowlist; v4 UUID required; original caller/tenant rechecked in Firestore reservation and finalize transactions.
- `updateTenantStaff({expectedTenantId,operationId,uid,expectedRevision,displayName,role,businessScope,active})`: staff-only target; exact tenant+membership canonical proof, native Auth preflight, immutable expected revision CAS and per-staff lock.
- `getTenantStaffOperationStatus({expectedTenantId,operationId})`: **read only**, same authenticated Owner and same tenant/actor as original. Independently reads operation, both canonical Firestore staff documents and real Firebase Auth. For a create, also checks global email reservation. For a completed update, verifies the per-staff lock was released.

**Status values:** `complete_verified` only if server receipt, staff profile, membership and Auth agree; `failed_released` only after a **definite** Auth create rejection and verified absence; `pending_review` for a reserved/in-flight command; `review_required` for partial or conflicting state; `not_found` does **not** mean safe to retry. There is **no automatic resubmission**, no force-complete and no password/email returned by status.

### Database and Auth boundaries

```text
tenants/{tenantId}/staffOperations/{UUID}       ← owner+tenant+command receipt
tenants/{tenantId}/staffAccountLocks/{staffUid} ← update serialization
staffEmailReservations/{SHA256(lowercaseEmail)} ← cross-tenant create reservation
users/{staffUid}                                ← canonical user profile
tenants/{tenantId}/memberships/{staffUid}       ← canonical staff membership
Firebase Auth users/{staffUid}                   ← native login / disabled state
```

Every operation/lock/reservation collection is browser read/write denied by Firestore Rules including Superadmin browsers. The canonical staff documents remain subject to existing Rules, but write-side changes in this module use Admin SDK transactions only. No staff personal data is put in the client session lock.

### Create pseudocode (one operation UUID)

1. Verify authenticated active Owner, canonical Tenant `ownerUid`, enabled native Auth and strict role/scope/credential input.
2. Reserve per-UUID operation **and** SHA-256 email key in a Firestore transaction. Same UUID or competing email cannot issue another Auth create. Derive deterministic Auth UID from UUID.
3. Create the native Auth user with `emailVerified:false`; never pretend an invitation/verification email was sent.
4. Finalize canonical user, Tenant membership, operation `complete` and email reservation `complete` in one Firestore transaction.
5. On a definitively rejected Auth request, release only after checking the deterministic Auth UID and both staff documents are absent. Ambiguous Auth/create/Firestore results stay reserved for manual review; **never auto-delete an Auth user after an unknown Firestore commit**.
6. Browser independently checks operation status and lists staff again before showing success or clearing its session lock.

### Edit / suspension pseudocode

1. Verify active Owner, canonical same-tenant user and membership, staff role and expected revision; independently verify existing native Auth before any lock.
2. Reserve operation UUID and per-staff lock in transaction; two concurrent commands cannot race on the same staff ID.
3. Update the native Auth display name and disabled flag.
4. Transactionally update `users` and `memberships`, advance `staffRevision`, finalize receipt and delete lock.
5. Read-only status validates the new revision, role, scope, active flag and actual native Auth. Any partial result remains locked for direct operator reconciliation; no false success.

## 3. React / session recovery

- Owner/tenant-scoped `sessionStorage` contains **only one opaque UUID**; no name, email, password, bank data, Firebase token or staff update body.
- A protected status card survives route reload and offers **ตรวจสถานะคำสั่งเดิม**. While unresolved, creation and update buttons are disabled.
- If storage is absent or corrupted, mutation is blocked. If status is `complete_verified`, the UI must also independently retrieve the staff list and confirm the same UID and revision. A verified `failed_released` unlocks without claiming success.
- Malformed server responses, unknown errors, `not_found`, stale status, conflicting receipts and changing tenant identity **never** release the lock automatically.
- The Add Staff dialog waits for the old controlled form to reset before reopening; a possibly submitted command closes the modal to expose the recovery card.
- Icon controls and mobile/desktop hierarchy remain PENGUIN/Source-equivalent. **No email delivery/invitation UI success is claimed.**

## 4. Test evidence and remaining release gates

| Gate | Evidence |
| --- | --- |
| Dedicated policy, strict request types and session recovery unit tests | PASS |
| Actual React Browser flow: create, lost response after server commit, reload, status, edit, suspend | PASS, 390 and 1440 px |
| Recovery notice viewport/overflow | PASS, 320 / 390 / 768 / 1440 px |
| Native Auth + Firestore Emulator: tenant/Owner authorization, create, concurrent UUID/email claims, duplicate rejects, stale revision, update/disable, missing Auth and incomplete operations | PASS |
| Browser Firestore Rules deny read/write on all reservation collections | PASS |
| Combined P1.3b + existing P1 onboarding Emulator tests | **16/16 PASS** |
| New Node + Chrome suite `npm run test:staff-operation` | **10/10 PASS** |
| Whole-project React parity suite | **PASS, Exit 0**, final P1.3b source |
| Vite React build and generated Hosting contract | **PASS**, existing Build `2026.11.09.535`; verification only, generated assets not deployed or committed |
| Real Firebase Production sign-in/email provider/mobile FCM | **NOT TESTED / NOT RELEASED** |

**Operational exception:** A reserved operation with partial Auth/Firestore proof intentionally requires administrator intervention. The project has no autonomous repair of partial provider outcomes. Never infer authorization to delete an Auth user, retry a staff command, or unblock a claim from absence alone.

**Out of scope:** P1.3c Owner attach/rename lifecycle; P1.3d actual invitation email and signed browser UAT; P1.4 Pricing/SaaS; APK/IPA builds; `main` merge; any Firebase Hosting/Functions/Rules Production deploy.
