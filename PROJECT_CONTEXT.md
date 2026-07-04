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

## Current Milestone

`POS Hardening 002`

## This Change

- Fixed POS staff separation between `/admin/users` and `/pos/users`.
- `/admin/users` now filters users marked as POS/retail scoped staff from the restaurant/admin staff list.
- `/pos/users` hides owner/current owner accounts from the POS managed user list.
- POS managed users are saved with POS markers: `staffScope: pos`, `source: pos`, `userType: retail_pos_staff`.
- The `/pos/users` edit dialog label is now `อีเมลสำหรับเข้าสู่ระบบ`.
- Existing POS user email is read only while editing and is preserved on save.
- UI/data-separation change only; no changes to sales, payment, Online/Offline, Sync, stable `saleId`, Firestore transaction, or Stock Transaction logic.
- Developer Panel remains Version `0.12.70` Build `2026.07.02.024`.

## Regression Tests

1. Open `/admin/users` and confirm POS-scoped users are not listed in restaurant/admin staff management.
2. Open `/pos/users` as owner and confirm the owner account/current owner is not listed as a managed employee.
3. Add a POS user and confirm it appears in `/pos/users` with a non-owner role.
4. Edit a POS user and confirm the label says `อีเมลสำหรับเข้าสู่ระบบ`.
5. Confirm existing POS user email is read only during edit and remains unchanged after save.
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