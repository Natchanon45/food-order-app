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

## Current Milestone

`POS Hardening 002`

## This Change

- Added a `หน้าหลัก` link on `/login` to return users to `/`.
- Placed the home link above the login card for both desktop and mobile.
- Used a Bootstrap home icon with `.app-icon` to match the app icon standard.
- UI-only change for the login page.
- No changes to Auth logic, Tenant, Firestore, POS, Sync, stable `saleId`, or Stock Transaction.
- Developer Panel remains Version `0.12.70` Build `2026.07.02.024`.

## Regression Tests

1. Open `/login` and confirm the `หน้าหลัก` link is visible above the login card.
2. Click `หน้าหลัก` and confirm it navigates to `/`.
3. Confirm login form email/password and password toggle still work.
4. Confirm login submit button and error fallback still work.
5. Confirm no POS, Sync, Firestore, or Stock Transaction logic changed.

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