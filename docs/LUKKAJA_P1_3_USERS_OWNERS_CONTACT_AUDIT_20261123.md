# P1.3 — Users, Owners and Public Contact: source parity / Firebase boundary audit

**Date:** 2026-11-23 (Asia/Bangkok)
**Status:** P1.3a–e plus **P1.3f signed real React Browser UAT implemented and Emulator-tested locally**. All 144 Callable definitions in 45 modules share a pre-handler email-verification guard. **Actual Staging Provider email/HTTPS UAT, independent HTTP/provider audits and Production signoff OPEN.** Staging is not configured in checked-in `.firebaserc` (Production default only).
**Source, strictly read-only:** `cosmatch/lukkhaja` / `feature/lukkaja_bankalert_stripe` @ `8b108f1278b7c59bd44c02133d659b8e6cd6fd3f`.
**Destination only:** `Natchanon45/food-order-app` / `feature/react-firebase-port` (baseline `0bf16cd1`).

The 8b108f Source delta after 18093091 changes APK copy/build scripts, .gitignore, docs and tests but **zero JSX**. The 23 November full Source JSX inventory remains pinned; do not claim route/action completeness from line counts.

## Three page-files in this module

| Page | Source JSX lines | Target JSX lines after this slice | Main Firebase boundary | Status |
| --- | ---: | ---: | --- | --- |
| `PlatformOwnersPage` | 371 | 522 | `platformTenantService` → UUID Owner + explicit Firebase invitation | P1.3c Owner and P1.3d invitation local/browser tested; live email/UAT open |
| `AdminUsersPage` | 435 | 614 | `adminStaff` → UUID Staff + explicit Firebase invitation | P1.3b Staff and P1.3d invitation local/browser tested; live email/UAT open |
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
2. Owner CREATE/EDIT: active Superadmin → typed UUID/expected snapshot → immutable tenant and email reservations → deterministic native Auth UID / revision CAS → transactional Tenant+profile+membership update → independent Auth+Firestore+Slug+billing status and canonical list verification. Legacy unversioned callables are now aliases to this strict flow; unknown results stay reserved. Never claim email sent.
3. Staff READ: owner-only UI + server profile role → expectedTenantId must match canonical owner tenant → list membership projections → reject stale tenant response and failed read.
4. Staff CREATE: strict owner-scoped input → UUID and globally unique email reservation → deterministic native Auth UID → transactionally finalize user/membership/receipt → independent status and staff-list verification. Reserved partial Auth results remain review-required, not auto retried.
5. Staff EDIT/SUSPEND: owner+tenant+native Auth preflight → exact staffRevision CAS and per-staff lock → native Auth update → transactionally update both Firestore mirrors and release lock → status+canonical read. Never claim atomic Auth+Firestore cross-service mutation or email delivery.
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
| Firebase Auth/Firestore create/edit/suspend across tenants | P1.3b Emulator combined 16/16 PASS; protected private receipt/lock collections |
| Owner/staff ambiguous Auth provisioning recovery | Staff P1.3b + Owner P1.3c both completed locally; combined Emulator 25/25 PASS |
| Actual email delivery, verification/invitation | Verification + reset invitation **IMPLEMENTED, Auth Emulator PASS**; live email delivery and template/provider configuration **NOT TESTED** |
| Final native Cloud Functions email verification security boundary | **P1.3e local gate and tests PASS:** 144 Callable definitions / 45 modules, 34/34 combined Emulator, 6/6 contract; signed HTTPS staging NOT TESTED |
| Mobile native LK Shop package/FCM end-to-end | BLOCKED; UI does not assert installed APK readiness |
| Owner manual browser acceptance on live PENGUIN | NOT PERFORMED |
| Production Firebase Functions/Rules/Hosting deployment | NOT AUTHORIZED, NOT PERFORMED |

## Next submodules before declaring P1.3 complete

**P1.3b COMPLETE IN LOCAL CODE + REGRESSION (not Production):** Staff account create/update recovery now has UUID/idempotency locks, owner+tenant-scoped status, Auth ambiguity handling without duplicate creation, independent Firestore/Auth readback, Emulator concurrency and Browser tests. See [P1.3b acceptance](./LUKKAJA_P1_3_STAFF_ACCOUNT_LIFECYCLE_20261123.md). No automatic email claim.

**P1.3c COMPLETE IN LOCAL CODE + REGRESSION (not Production):** Existing unowned Tenant → Owner attach/rename uses strict UUID reservation/CAS, verified native Auth, tenant/slug/membership coherence and immutable billing digest; pristine placeholders start trial exactly once and activated ownerless Tenants keep financial and subscription history. Browser Recovery rechecks original receipt without duplicating Auth. See [P1.3c receipt](./LUKKAJA_P1_3_OWNER_ACCOUNT_LIFECYCLE_20261123.md).

**P1.3d COMPLETE IN LOCAL CODE + EMULATOR/BROWSER (not Production):** Opt-in email verification for new Owner/Staff, explicit Firebase password setup invitation, verification page, refreshed native Auth token, Firestore/Storage private-access gate, legacy/public exemptions. **31/31** combined native Firebase Emulator; managed React/Chrome **3/3**; Owner/Staff invitation Browser **2/2**; full React parity and Vite build PASS. [P1.3d implementation and staged UAT checklist](./LUKKAJA_P1_3_MANAGED_EMAIL_INVITATION_20261123.md). The next release gates are actual provider-approved emails, signed staging browser UAT, Source Contact/Google/LK Shop provider test, and **Cloud Functions-wide authorization verification**. All require explicit user approval before Production.

**P1.3f COMPLETE IN LOCAL EMULATOR ONLY:** Real signed Chrome login for Superadmin/Owner/Cashier, Contact+Google Firestore read-after-write, scoped LK Shop closed Pilot, exact `VERIFY_EMAIL` Auth Emulator one-time action and native token refresh, denied Cashier Superadmin page, stable billing. **1/1 signed Browser UAT PASS; 6/6 staging configuration and no-deploy guard PASS.** Offline preflight correctly reports **BLOCKED** because only the Production `.firebaserc` default is available. See [P1.3f staging readiness and release gates](./LUKKAJA_P1_3_STAGING_UAT_READINESS_20261123.md). No real Staging/Production UAT, email, deploy or financial-provider writes.

**P1.3e COMPLETE LOCALLY (NOT STAGING OR PRODUCTION):** centralized Firebase Callable pre-handler managed verified-email gate, 144/45 static coverage, 16 representative protected operational/financial/identity Callables blocked before mutation, all existing Owner/Staff/Onboarding tests regressed. [Audit/acceptance](./LUKKAJA_P1_3_FINAL_CALLABLE_SECURITY_AUDIT_20261123.md). Seven HTTP endpoints retain original webhook/device/public policies and require separate acceptance.

**Safety:** no live Firebase deploy, no `main` merge, no Source mutation, no Auth or bank/finance writes were made by this UI slice. The Source still uses its own Go backend and LK Shop native APK; PENGUIN never claims those contracts are active.
