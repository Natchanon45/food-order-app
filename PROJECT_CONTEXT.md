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

## Current Milestone

`POS Hardening 002`

## This Change

- Fixed duplicated left-arrow icon on `/admin/sales-report` back action.
- Added `.app-icon` to the existing Bootstrap back icon so `ui.js` treats it as already decorated.
- Bumped `sales-report.js` query string to `v=20260704-004` to prevent browser cache after the HTML import update.
- UI-only change for the sales report header.
- No changes to report logic, calculations, Online/Offline, Sync, stable `saleId`, Firestore, or Stock Transaction.
- Developer Panel remains Version `0.12.70` Build `2026.07.02.024`.

## Regression Tests

1. Open `/admin/sales-report` and confirm the back action displays `ย้อนกลับ`.
2. Confirm the back action has only one left-arrow icon.
3. Confirm the hourly sales chart title still has an icon.
4. Confirm sales report calculations still work.
5. Confirm important records still include `tenantId`.

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