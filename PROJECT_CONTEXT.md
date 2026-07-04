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
- Milestone: `POS Hardening 002`

## Done

- QR Table Order / Take Away / Kitchen / Cashier / Delivery done
- Retail POS supports Online / Offline / Sync / Tenant
- POS Roadmap P9-B001 to P9-B010 done
- POS Hardening 001 done
- POS Hardening 002 done
- Sales Report Icon Polish done
- Sales Report Icon Hotfix done
- Sales Report Back Label Polish done
- Sales Report Back Icon Duplication Fix done
- Login Home Link done
- POS User Visibility Fixes done
- Admin Staff Callable Hotfix done
- Restaurant Staff Role Function Fix done

## Current Milestone

`POS Hardening 002`

## This Change

- Fixed restaurant/admin staff Cloud Function role rules.
- `functions/staff-admin.js` now allows only restaurant staff roles: `admin`, `cashier`, `kitchen`.
- `createTenantStaff` and `updateTenantStaff` now accept `kitchen`, fixing `FirebaseError: Invalid staff role`.
- Newly created restaurant staff records are marked with `staffScope: restaurant` and `source: order_delivery`.
- Tightened `/admin/users` legacy POS filter to hide records like `cashier01` while keeping normal restaurant cashier rows like `Cashier`.
- This change requires deploying both functions and hosting.
- No changes to sales, payment, Online/Offline, Sync, stable `saleId`, Firestore transaction, or Stock Transaction logic.
- Developer Panel remains Version `0.12.70` Build `2026.07.02.024`.

## Regression Tests

1. Deploy `functions,hosting`.
2. Open `/admin/users` and confirm `cashier01` no longer appears.
3. Create a `Kitchen` staff user and confirm it succeeds without `Invalid staff role`.
4. Save an existing restaurant/admin staff row and confirm save succeeds.
5. Confirm normal restaurant rows such as `Admin`, `Cashier`, and `Kitchen` still appear when not POS scoped.
6. Confirm POS sale, payment, sync, stock, and tenant data are unchanged.

## Next Tasks

- POS Hardening 003: check duplicate event listeners and snapshot unsubscribe patterns
- Safely retest product display order in `/pos`

## Notes

- Every important record must include `tenantId`.
- Do not sync POS across tenants.
- Use the same stable sale/order id online and offline.
- Firestore transactions must read all documents before writes.
- If imported JS/CSS changes, bump query string.
- If `storage.rules` changes, deploy with `firebase deploy --only storage`.