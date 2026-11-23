# P1.3 — Users, Owners and Public Contact: source parity / Firebase boundary audit

**Date:** 2026-11-23 (Asia/Bangkok)
**Status:** UI parity slice complete for Contact LK Shop presentation; **P1.3 identity lifecycle and production acceptance OPEN**.
**Source, strictly read-only:** `cosmatch/lukkhaja` / `feature/lukkaja_bankalert_stripe` @ `8b108f1278b7c59bd44c02133d659b8e6cd6fd3f`.
**Destination only:** `Natchanon45/food-order-app` / `feature/react-firebase-port` (baseline `0bf16cd1`).

The 8b108f Source delta after 18093091 changes APK copy/build scripts, .gitignore, docs and tests but **zero JSX**. The 23 November full Source JSX inventory remains pinned; do not claim route/action completeness from line counts.

## Three page-files in this module

| Page | Source JSX lines | Target JSX lines after this slice | Main Firebase boundary | Status |
| --- | ---: | ---: | --- | --- |
| `PlatformOwnersPage` | 371 | 397 | `platformTenantService` → `listTenants/createTenantOwner/updateTenantOwner` | JSX aligned; identity operation acceptance blocked |
| `AdminUsersPage` | 435 | 436 | `adminStaff` → `listTenantStaff/createTenantStaff/updateTenantStaff` | JSX aligned; ambiguous Auth/write recovery and email proof blocked |
| `PlatformContactPage` | 664 | 665 | `platformContactService`/Telegram/`LKShopPairingPanel` | Source LK Shop layout + preview ported; provider UAT blocked |

**Source UI fidelity:** original page hierarchy, button intents, form labels, action order, collapse layout, preview structure and responsive CSS retained. Firebase Auth, Firestore, Cloud Functions, PENGUIN labels and actual pairing gate remain destination-native. Do not import Laravel/Go/SQL or deploy Source assets.

## P1.3 UI slice now implemented (P1.3a)

- `PlatformContactPage.jsx`: restored original Source `platform-lk-shop-layout` with left Settings card, right Demo Preview card, header/corner collapse and separate hidden bodies. Source example is relabeled PENGUIN and explicitly non-live; no payment confirmation is inferred from it.
- Preserved the existing Firebase `LKShopPairingPanel scope="platform"`, notify callback, lazy mount on expansion, gated Native APK readiness and tenant-versus-platform isolation. No LUKKAJA Go endpoint is called.
- `platform-contact-card-collapse.css`: imported 198-line Source CSS suffix for equal card/grid treatment and 1040/720/520 px responsive rules; retained earlier Target CSS unchanged.
- `p1-contact-card-port.spec.mjs` and `p1-lk-shop-pairing-browser.spec.mjs` updated for the current collapsed 4-card tree and Source DOM identifier.
- `p1-contact-lk-shop-layout-browser.spec.mjs` added: Chrome at 320 / 390 / 768 / 1440 px, no horizontal overflow, desktop two columns, tablet/mobile single column, demo hidden initially, and scope/branding invariants. Registered with `test:lk-shop-firebase`.

## Action-family inventory (22, not 22 accepted workflows)

Owners 1–7: (1) authorized list/load, (2) search, (3) status filter, (4) open owner create modal, (5) create owner + activation plan, (6) change owner display name, (7) canonical read-after-write / ambiguous result handling.

Staff 8–14: (8) tenant-scoped list, (9) search by name/email/role/scope, (10) active/suspended filter, (11) create staff and Auth identity, (12) edit name/role/business scope, (13) activate/suspend account, (14) reload/collision/error presentation.

Contact 15–22: (15) load global public contact, (16) update contact channel data, (17) preview valid enabled channels, (18) read Google login settings, (19) validate/save Google settings, (20) Telegram admin configuration/reload/demo, (21) LK Shop platform QR challenge and room selection, (22) list/revoke paired devices and preview sample notification.

These are source/UI action families. They are **not** signed-off backend scenarios or independent production capabilities.

## Firebase action pseudocode boundaries (7)

1. Owners READ: require active super_admin → trusted listTenants → normalize fields → search/filter; no credential or password leak.
2. Owner CREATE/EDIT: require active super_admin → validate name/email/password/plan → trusted Callable → independently re-read canonical Tenant. **Legacy createTenantOwner is not idempotent under an unknown Auth outcome; NOT signed off.** Never claim email sent.
3. Staff READ: owner-only UI + server profile role → expectedTenantId must match canonical owner tenant → list membership projections → reject stale tenant response and failed read.
4. Staff CREATE: validate role/scope/credentials → trusted Auth creation then Firestore profile + membership. **Auth and Firestore are not one ACID transaction; operation receipt/status recovery is still needed.**
5. Staff EDIT/SUSPEND: owner scope + target staff membership checked → Auth disabled flag and Firestore profile/membership updated. **Do not claim atomic cross-service success or delivered email without separate proof.**
6. Contact SAVE: validated Superadmin Firestore Rule → `platformSettings/publicContact` or `googleCustomerLogin` → independent getDoc confirmation → ambiguous failures stay locked.
7. LK Shop: authorized role + room selection → one-time short-lived Firebase QR challenge → platform room only; signed mobile device/FCM/APNs proof and native app readiness are separate gated dependencies.

## Acceptance matrix and blockers

| Evidence / scenario | Current result |
| --- | --- |
| Source-only branch left unchanged | VERIFIED |
| Owner / staff page JSX structure vs Source | COMPARED, existing Firebase adapters retained |
| Contact Source layout and CSS | IMPLEMENTED |
| Contact collapse and Telegram regression | 2/2 PASS |
| LK Shop Firebase policy + Chrome UI + new layout | 12/12 PASS |
| Chrome 320 / 390 / 768 / 1440 layout | PASS |
| Full React parity regression | See current worklog / release receipt |
| React build and generated-asset contract | See current worklog / release receipt |
| Firebase Auth/Firestore create/edit/suspend across tenants | NOT NEWLY CERTIFIED by P1.3a |
| Owner/staff ambiguous Auth provisioning recovery | BLOCKED; strict server idempotency/status needed |
| Actual email delivery, verification/invitation | NOT IMPLEMENTED OR PROVEN by this slice |
| Mobile native LK Shop package/FCM end-to-end | BLOCKED; UI does not assert installed APK readiness |
| Owner manual browser acceptance on live PENGUIN | NOT PERFORMED |
| Production Firebase Functions/Rules/Hosting deployment | NOT AUTHORIZED, NOT PERFORMED |

## Next submodules before declaring P1.3 complete

**P1.3b** — Staff account create/update recovery: server-issued immutable operation receipt, actor/tenant-scoped status, Auth ambiguity handling without duplicate creation, independent Firestore/Auth verification, fail-closed behavior when disabled/role/scope mismatch; Emulator concurrency and denial tests. No automatic email claim.

**P1.3c** — Existing unowned Tenant → Owner attach/rename: replace legacy `createTenantOwner` / `updateTenantOwner` ambiguous multi-service operations with guarded CAS/idempotency/status and immutable original activation. Reuse P1.2c provenance rules; do not recreate or backdate the free trial.

**P1.3d** — Provider-backed email verification/invitation and authorized Superadmin/Owner browser UAT; test global contact/Google settings and LK Shop room pairing with real provider credentials separately. Require explicit approval before any Production deployment.

**Safety:** no live Firebase deploy, no `main` merge, no Source mutation, no Auth or bank/finance writes were made by this UI slice. The Source still uses its own Go backend and LK Shop native APK; PENGUIN never claims those contracts are active.
