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
- Milestone: `Cashier Access Fix`

## Done

- QR Table Order / Take Away / Kitchen / Cashier / Delivery done
- Retail POS supports Online / Offline / Sync / Tenant
- Public Registration Phase 2 done
- Cashier Access Fix done

## Current Milestone

`Cashier Access Fix`

## This Change

- Fixed shared cashier role behavior between restaurant cashier and retail POS cashier.
- Main dashboard now checks business unit/module data before showing Retail POS cards.
- `/pos` now uses module-aware guard.
- POS login now rejects restaurant-only cashier accounts.
- No sale, stock, sync, or transaction logic changed.

## Regression Tests

1. Deploy hosting.
2. Log in as restaurant cashier and confirm Retail POS card is hidden.
3. Confirm direct `/pos` access redirects away for restaurant cashier.
4. Confirm `/pos/login` rejects restaurant cashier.
5. Confirm restaurant cashier can still access restaurant cashier pages.
6. Confirm owner or retail POS staff can still access Retail POS.

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