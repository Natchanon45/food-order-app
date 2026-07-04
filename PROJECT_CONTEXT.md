# Food Order App — Project Context / POS Roadmap

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`
Main product: QR Table Order + Take Away + Kitchen + Cashier + Delivery + Retail POS

## Workflow

1. Read `PROJECT_CONTEXT.md` before work.
2. Check latest HEAD before editing.
3. Report Version / Build / HEAD after work.
4. Keep changes small.
5. Bump query string when imported JS/CSS changes.
6. Update README and context after code changes.
7. Report deploy commands.

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Branch: `feature/retail-pos`
- Milestone: `Unified Login Fix`

## Done

- QR Table Order / Take Away / Kitchen / Cashier / Delivery done
- Retail POS supports Online / Offline / Sync / Tenant
- Public Registration Phase 2 done
- Cashier Access Fix done
- Unified Login Fix done

## Current Milestone

`Unified Login Fix`

## This Change

- Unified staff login through `/login`.
- `/login` clears old POS session before new sign-in.
- `/login?next=/pos/` signs in once and prepares POS session.
- `/pos/login` no longer shows the old POS login form.
- Login form autocomplete is disabled.
- Main page POS quick login is patched by `home-session-fa.js`.
- No sale, stock, sync, or transaction logic changed.

## Regression Tests

1. Deploy hosting.
2. Hard refresh `/login` and confirm fields are empty.
3. Open `/login?next=/pos/` and confirm POS opens after one login.
4. Open `/pos/login` and confirm the old form is gone.
5. Confirm restaurant cashier still cannot enter POS.
6. Confirm restaurant cashier pages still work.

## Next Tasks

- POS Hardening 003
- Safely retest product display order in `/pos`
- Package Selection Phase 3

## Notes

- Every important record must include `tenantId`.
- Do not sync POS across tenants.
- Use the same stable sale/order id online and offline.
- Firestore transactions must read all documents before writes.
- If imported JS/CSS changes, bump query string.
- If `storage.rules` changes, deploy with `firebase deploy --only storage`.