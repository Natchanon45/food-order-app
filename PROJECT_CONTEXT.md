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
- Milestone: `Login Link Polish`

## Done

- QR Table Order / Take Away / Kitchen / Cashier / Delivery done
- Retail POS supports Online / Offline / Sync / Tenant
- Unified Login Fix done
- Login Link Polish done

## Current Milestone

`Login Link Polish`

## This Change

- Moved `/login` home link below the login card.
- Centered the home link.
- Changed the home link badge to light green.
- UI-only change. No auth, POS, sale, stock, sync, or transaction logic changed.

## Regression Tests

1. Deploy hosting.
2. Hard refresh `/login`.
3. Confirm home link is below and centered.
4. Confirm login still works.

## Next Tasks

- POS Hardening 003
- Retest product display order in `/pos`
- Package Selection Phase 3

## Notes

- Every important record must include `tenantId`.
- Do not sync POS across tenants.
- Use stable sale/order id online and offline.
- Firestore transactions must read before writes.
- If JS/CSS changes, bump query string.