# P1.1 — Super Admin Platform JSX port audit (opened 09/11/2026)

**Status:** `hosting_0.4.305_live_verified__signed_in_uat_pending` — incremental Firebase Hosting release verified, but signed-in Super Admin visual and write/read-failure UAT remain pending.

| Artifact | LUKKAJA source | PENGUIN destination |
| --- | --- | --- |
| GitHub branch | `cosmatch/lukkhaja@feature/react-golang-vite-tailwind-axios` | `Natchanon45/food-order-app@feature/react-firebase-port` |
| Pin | `e84c899028eb16c67401dcc05c5faed84bf48f63` | baseline `d87fc3752efff126dc9846d7cbe844aa982840a2` |
| JSX | `resources/js/react-port/pages/PlatformPage.jsx` | `react-app/src/pages/PlatformPage.jsx` |
| Snapshot file size | 828 source lines | 841 destination lines |
| Action status | **Pending per-control inventory** | **Pending Firebase interaction verification** |

## Important differences checked in pinned files

1. The source Platform JSX uses LUKKAJA auth/context and data interfaces: `LaravelAuthProvider`, `laravelPlatformBrandingService`, `laravelPlatformSettingsService`, `LaravelPlatformBrandingRuntime`. PENGUIN already uses `AuthProvider`, `platformBrandingService`, `platformSettingsService`, `PlatformBrandingRuntime`; **do not import Go/SQL service files into PENGUIN React**.
2. The source includes explicit `brandingStorageReady`, `googleStorageReady`, `slipStorageReady`, `lalamoveStorageReady` guards on submit/test actions. The destination currently has some controls disabled only by `*Busy`. Before adopting source JSX, implement equivalent readiness/permission guards using an authoritative Firebase contract, not a hard-coded `true`. Source UX must preserve disabled/error/loading semantics.
3. Destination already implements an additional Super Admin tenant-notification badge on the tenant navigation card. This is a PENGUIN feature not present as the same JSX expression in the pinned LUKKAJA page; review whether this is a user-approved destination-specific feature **before** copying source markup. Never silently discard accepted functionality to improve superficial similarity.
4. Shared visual hierarchy to inspect at desktop/tablet/mobile: navigation cards, branding/logo/favicons, Google API settings, provider slip settings/beneficiary, Lalamove settings, read/write/test buttons, global notification and readiness overlays.
5. Source uses super_admin gating before settings writes and displays a platform-auth error state. Destination must keep an equally strict server-enforced role/tenant boundary, not only hide buttons.
6. Source may expose Go-only configuration or M7 financial actions. P1.1 is UI/adapter work only: do **not** deploy provider credentials, open money settlement, activate invoices/holds, or modify production Firebase documents.

## P1.1 implementation contracts to inventory and satisfy

| Source interaction / block | PENGUIN adapter boundary | Acceptance |
| --- | --- | --- |
| Platform shell and cards | Existing Firebase auth/route/tenant/profile services | Verify exact source markup and approved destination-specific exceptions |
| Platform branding upload/clear | `platformBrandingService` + Storage + scoped Functions/Rules | Blob type/size, loading, failure, invalid upload and icon preview |
| Global Google settings | `platformSettingsService` + Firebase Functions | Secret permission, busy/readiness and test errors |
| Slip2Go settings/test | `platformSettingsService` + backend-only verification | Server storage readiness, cannot leak API key or auto-approve mismatch |
| Lalamove settings/test | `platformSettingsService` + backend-only test call | Readiness, failures, disabled controls, never charge on UI test |
| Super Admin navigation badge | `platformAdminNotifications` | Preserve existing approved behavior unless source parity review explicitly replaces it |

## Implemented on `feature/react-firebase-port` — first source-equivalent Firebase slice

- Commit `4bbdaa6a` adapts source **read-failure and permissions guard semantics** for existing Branding, Google API, Slip Verification and Lalamove settings; disabled inputs/save/test/webhook controls remain in the original JSX UI hierarchy.
- Unlike the LUKKAJA Go response `item.storageReady`, these Firebase Callables return an authenticated `{ item: { ... } }`. The Firebase page sets `*ReadReady=true` **only** after a valid object response; any load error or malformed response keeps it false. This prevents saving dummy defaults after read failures while maintaining the actual Firebase endpoint contract.
- No mutations to Firebase Cloud Functions, Rules, API credentials or data stores were made. Existing PENGUIN-specific tenant notification badges, `PlatformReceiverBankSelect`, branding and previously hidden Hybrid billing navigation were preserved.
- `tests/react-parity/platform-firebase-readiness-port.spec.mjs` plus Phase 0 tracker check: 9/9 tests PASS. `npm run test:react-parity` PASS and `npm run build:react` / Generated React build contract PASS on Mac (09/11/2026).
- [22 grouped Platform action families + 4 pseudocode families + 18 scenarios](./LUKKAJA_P1_1_PLATFORM_ACTIONS.md) inventoried. Authenticated browser parity, real Firebase Emulator permission/write E2E, provider and responsive screen comparison **still pending**.

### Historical Hosting divergence (resolved for the 0.4.305 release)

- Actual `https://penguin-food.web.app/platform` currently references `/react/assets/index-D1lP61q7.js`.
- The exact same entrypoint is in the already-deployed old port branch `feature/port-lukkaja-20261031@fe338e1d`.
- The requested destination `feature/react-firebase-port` baseline currently references older `index-BVCU-hXZ.js`; a fresh Build from it produces `index-a8uMEtpo.js` (generated contract version `2026.10.19.526`).
- **At the initial 0.4.296 snapshot**, deploying this target Branch would have regressed already-live features. Those missing files were subsequently imported from the pinned old deployed Branch into the requested target by explicit allowlist and verified with the 12-group predeployment source gate, full React tests, Emulator checks and anonymous Browser Smoke.
- The original P1.1 read-guard commit did not deploy by itself; the later integrated Hosting-only **0.4.305** release was verified on 09/11/2026.

## Verified incremental release (09/11/2026)

- Destination commit: `fb3d249f1a15cce1f24499dd2f5026f00f0abb97`; PENGUIN 0.4.305, Build `2026.11.09.535`.
- Firebase Hosting **only** (`hosting:foodapp`) successfully published to `https://penguin-food.web.app`. No new Cloud Functions/Firestore Rules/data deployment, no LUKKAJA edit, and no merge into main.
- Serving JS `/react/assets/index-CoVwNJEQ.js` confirmed identical to the build's file, SHA-256 `62f45d8b784efd1e364862a7891abf5b29b85a555cca26ad3ef9b067f1b7d7c9`.
- Full React parity/build: PASS; preservation preflight: 12/12; synthetic Auth/Firestore Emulator Walk-in transaction/rules tests: 2/2; anonymous browser redirects through Hosting Emulator (including Platform): 17/17.
- This is **not** completion of the fully authenticated source UI or platform/provider UAT. Review still requires actual super_admin login, request failure injection, write rights, visual screenshots and provider outcome testing. Source P1.2 Tenant audit is [here](./LUKKAJA_P1_2_SUPERADMIN_TENANTS_AUDIT.md).

## Concrete next steps within P1.1

1. Freeze exact JSX/CSS/component references for `PlatformPage.jsx` and capture source-vs-target screenshots at the **same demo data, role and viewport**.
2. Inventory all visible buttons/inputs, their permission, mutations, error/retry behavior and data read status; count pseudocode/scenarios **after inspecting actual actions**.
3. Create a Firebase read/write facade matching source action contracts while keeping JSX presentation and PENGUIN-specific branding; do not inline backend details in markup.
4. Add source parity tests plus Firebase Emulator permission tests for write actions, then approved browser visual UAT.
5. GitHub-first commit/Pull/Build; deploy Hosting only when the current live build is proved not to regress. Functions/Rules updates are separate, reviewed operations.

**Source is read-only.** Historical candidate `feature/port-lukkaja-20261031@fe338e1d` is available for reuse but cannot be merged wholesale or treated as current accepted source.
