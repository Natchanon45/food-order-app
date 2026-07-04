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

## Current Milestone

`POS Hardening 002`

## This Change

- Fixed `/admin/users` save failure caused by calling non-exported callable names.
- `admin-staff-service.js` now calls existing functions: `listTenantStaff`, `createTenantStaff`, and `updateTenantStaff`.
- Fixed CORS/failed request from old callable name `updateStaffUser`.
- Added legacy POS-user filtering for records without POS markers but with local POS traits such as `username`, `passwordHash`, `passwordSalt`, `user-` ids, or POS-style `roleId`.
- Bumped `/admin/users` script to `admin-users.js?v=20260704-002` and `admin-staff-service.js?v=20260704-002`.
- User-management hotfix only; no changes to sales, payment, Online/Offline, Sync, stable `saleId`, Firestore transaction, or Stock Transaction logic.
- Developer Panel remains Version `0.12.70` Build `2026.07.02.024`.

## Regression Tests

1. Open `/admin/users` and confirm old POS/local users such as `cashier01` no longer appear in restaurant/admin staff management.
2. Edit a restaurant/admin staff row and confirm save succeeds without CORS error.
3. Confirm `/admin/users` still lists restaurant staff roles `admin`, `cashier`, and `kitchen` when they are not POS scoped.
4. Confirm `/pos/users` still hides owner/current owner and keeps email read only during edit.
5. Confirm POS sale, payment, sync, stock, and tenant data are unchanged.

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