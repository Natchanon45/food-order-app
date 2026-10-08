# React + Firebase Parity Verification Plan

Last updated: 2026-09-29

## Goal

The user must not be required to manually click every page, menu, and button to discover React migration gaps.

Laravel MASTER:
`/Users/natchanonsripleng/Desktop/Sites/food-order-app-php80` branch `main`

React/Firebase target:
`/Users/natchanonsripleng/Desktop/Sites/food-order-app`

Laravel MASTER remains the source of truth for UI and behavior unless the user explicitly requests a new UX change. When a new UX change is accepted, update MASTER and React parity assets together.

## Definition of Done

A route is **not verified** merely because it renders or visually resembles MASTER.

A route can be marked `verified` only when all required dimensions pass:

1. **Route and access**
   - canonical URL and aliases
   - authentication redirect
   - role/permission guard
   - tenant scope

2. **Visual parity**
   - DOM structure/classes where behavior depends on them
   - spacing, alignment, typography, icons, colors, badges
   - empty/loading/error/success states
   - modal/dialog layering and close behavior
   - desktop/tablet/mobile layouts

3. **Action parity**
   - every visible button/link/menu action is inventoried
   - every user-visible button or button-like link has a semantic icon; text buttons render icon first + label second
   - icon-to-label gap is at least 7px and the icon Y-center differs from the button Y-center by no more than 1px
   - same-row `element → button → element` and `element → badge → element` sequences keep at least 8px clear space on both sides of the button/badge
   - adjacent action gap is at least 8px, and action groups keep at least 12px from the section before/after
   - intentional icon-only controls retain a visible, Y-centered icon plus accessible label; text-only action buttons are not accepted
   - click result matches MASTER
   - navigation destination matches
   - modal/prompt/confirm text and button semantics match
   - toast/alert/error behavior matches
   - disabled/loading/busy behavior matches
   - repeated click / duplicate-submit protection matches

4. **Data and side effects**
   - Firestore/Function reads and writes target the correct tenant
   - expected fields/status transitions are produced
   - unrelated fields are preserved
   - destructive actions require the same confirmation/reason rules
   - transaction/idempotency/duplicate protection remains intact

5. **Failure paths**
   - permission denied
   - missing/invalid data
   - offline/network failure where relevant
   - Function failure
   - stale/conflicting state
   - retry behavior

6. **Language**
   - Thai, English, Myanmar, Lao, Khmer where the MASTER page supports them
   - no raw translation keys
   - action labels do not change semantics between locales

7. **Responsive**
   - desktop PC
   - tablet
   - mobile
   - buttons remain accessible and do not overlap/overflow

## Required action inventory

For every route, create an action inventory with at least:

- stable action ID
- visible label / icon
- actor role
- precondition
- MASTER behavior
- React behavior
- expected navigation/dialog/toast
- expected data mutation or explicit "no mutation"
- expected failure behavior
- automated coverage status

Actions include ordinary buttons plus:
- profile/header menus
- table/list row actions
- pagination
- filters/search/reset
- modal close/cancel/save
- file upload/remove
- print/copy/open-new-tab
- language switch
- toggles/selects that trigger persistence or dependency changes

## Verification levels

- `inventory_pending`: route exists but full controls/actions have not been inventoried.
- `inventory_complete`: all visible actions are listed.
- `contract_covered`: static/unit/contract checks cover markup, route, labels, or data contracts.
- `browser_covered`: browser automation executes the real interaction.
- `data_verified`: expected Firebase/Function side effects were checked.
- `visual_verified`: responsive MASTER-vs-React visual comparison passed.
- `verified`: every required dimension passed.

Do not promote a route to `verified` while any required dimension is pending.

## Automation layers

### Layer A — Static/contract checks (already available)
- `npm run test:react-foundation`
- `npm run test:react-migration`
- `npm run test:operational` where applicable
- `git diff --check`

Use these to catch missing routes, wrong markup contracts, missing translation/role rules, and known regression patterns.

### Layer B — Parity matrix validator
- `npm run test:react-parity-matrix`
- Ensures every MASTER registry route has a verification record.
- Prevents a route from being declared `verified` with incomplete required dimensions.
- Records missing action inventory explicitly instead of silently treating a rendered page as complete.

### Layer C — Browser interaction automation
Browser E2E is required to remove the need for manual button-by-button checking.

Runner: Playwright using the Mac's installed Google Chrome.

Current automated P0 suite: `npm run test:react-p0-browser`.
It currently covers all 20 P0 React route smoke checks, anonymous auth boundaries, public Waiting Queue invalid/missing-link states, PC/tablet/mobile public viewport checks, Login inline validation/password toggle/language switch, and Waiting Queue Display sound/fullscreen safety.

For each action:
1. prepare deterministic test data
2. open MASTER and record expected UI/behavior
3. open React target
4. execute the same action
5. assert navigation/dialog/toast/button state
6. assert data side effects
7. capture screenshots for desktop/tablet/mobile when visual output changes
8. restore isolated test data when needed

Playwright is now installed as a development dependency. Do not claim full button coverage merely because the current smoke suite passes: authenticated data-writing actions still require isolated Firebase runtime coverage.

Current emulator blocker on this Mac: Firestore Emulator requires a Java Runtime, and no Java/OpenJDK runtime is installed. Do not point destructive/write E2E at production data as a workaround. Until an isolated Firestore Emulator environment is available, use browser coverage for non-mutating interactions plus source/service side-effect contracts, and keep runtime data verification marked pending/partial.

## Risk priority

### P0 — must be automated first
- Super Admin Console: `/platform*`, `/admin/tenants`, `/super-admin/saas-setup`
- authentication / role / tenant boundaries
- Cashier: `/cashier*`
- Waiting Queue staff/customer/display
- payment, cancellation, table-opening, destructive actions
- Cloud Function-backed writes

### P1
- Admin owner workflows
- Kitchen
- Delivery / Take Away / Table Order
- Revenue Share
- QR generation/print flows

### P2
- POS management/report/configuration routes
- informational/public pages without mutation

## Visual comparison procedure

For routes with a Laravel MASTER equivalent:
- use the same fixture data
- use the same locale
- use matching viewport sizes
- compare header, content hierarchy, controls, cards/tables, dialogs, footer, icons
- compare loading/empty/error/success states, not only the default screen
- record intentional deviations requested by the user so they are not "fixed" back to old MASTER behavior

## Data safety rules for automated actions

- Never run destructive verification against uncontrolled production tenant data.
- Prefer emulator/test tenant/isolated fixture IDs.
- Do not reset/clean/discard the repository working tree.
- For idempotency tests, reuse stable test IDs intentionally and assert no duplicate side effect.
- For destructive actions, capture the exact documents/fields expected to change before clicking.

## Working files

- Route source registry: `react-app/migration/master-registry.json`
- Verification matrix: `react-app/migration/parity-verification-matrix.json`
- Matrix validator: `tools/react-parity-matrix.mjs`
- P0 action/side-effect contract: `tools/react-p0-action-contract.mjs`
- P0 browser tests: `tests/react-parity/p0-smoke.spec.mjs`
- Coverage report: `npm run report:react-parity`
- Structural regression contracts: `tools/react-foundation-contract.mjs`
- Route migration coverage: `tools/react-migration-coverage.mjs`
- Current handoff: `docs/NEXT_CHAT_HANDOFF.md`

## Immediate execution order

1. Keep the canonical React-only entrypoints protected by structural and route-coverage contracts.
2. Keep expanding non-mutating P0 Playwright interactions and responsive checks.
3. Prepare deterministic authenticated role fixtures for Super Admin / Owner / Admin / Manager / Cashier.
4. Provide an isolated Firestore Emulator runtime (Java/OpenJDK or another isolated environment); do not substitute production writes.
5. Automate P0 success/failure/write actions and verify exact Firestore/Function side effects.
6. Add MASTER-vs-React responsive screenshot comparison only where Laravel MASTER remains the requested behavior reference.
7. Prevent page-specific legacy JavaScript/CSS runtime directories from returning to Firebase Hosting.
8. Expand the same verification system to P1 then P2.
9. Only mark a verification group complete after its required dimensions pass, not after visual inspection alone.


## Global initial readiness parity
- Every user-visible React route shows the shared full-screen `PageReadyOverlay` until required styles and initial auth/tenant/data have settled.
- Loading content is centered on both X/Y axes and contains the spinner + localized shared loading/wait text. A progress bar appears only when the route supplies measurable real 0–100% progress; hard-coded estimates and indeterminate/fake progress are forbidden.
- Partial page UI and page-specific initial loading blocks must not appear underneath or after the global overlay; the overlay remains until all critical initial page-component data are settled.
- Redirect/compatibility routes show the same overlay while navigation is pending.
- Successful readiness removes the initial overlay completely; explicit initial-load failures move to a clear error state.
