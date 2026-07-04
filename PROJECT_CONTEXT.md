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
- Milestone: `Public Registration Phase 2`

## Done

- QR Table Order / Take Away / Kitchen / Cashier / Delivery done
- Retail POS supports Online / Offline / Sync / Tenant
- POS Roadmap P9-B001 to P9-B010 done
- POS Hardening 001 done
- POS Hardening 002 done
- Business Unit Staff Filter Fix done
- Public Trial Signup Phase 1 done
- Signup Email Verification Hotfix done
- Register Existing Auth Email + Layout Hotfix done
- Register Slug Pattern Hotfix done
- Public Registration Phase 2 done

## Current Milestone

`Public Registration Phase 2`

## This Change

- Enabled the public landing `ลงทะเบียน` CTA.
- Updated `public/index.html` so the register button links directly to `/register/`.
- Updated the public landing note to mention Premium Trial signup after email verification.
- Added a defensive CTA patch in `home-session-fa.js` so the register link is corrected on page load.
- Bumped `home-session-fa.js` import in `public/index.html` to `v=20260704-001`.
- Hosting/static change only; no changes to tenant activation functions, POS sales, stock, sync, or Firestore transactions.

## Regression Tests

1. Deploy hosting.
2. Open `/` with hard refresh while logged out.
3. Confirm the `ลงทะเบียน` button is enabled and opens `/register/`.
4. Confirm the `ลงชื่อเข้าใช้` button still opens `/login`.
5. Confirm logged-in staff still sees the staff dashboard and role-based menu.
6. Confirm existing `/register/` signup flow remains unchanged.
7. Confirm POS, stock, sync, and existing tenants are unchanged.

## Next Tasks

- POS Hardening 003: check duplicate event listeners and snapshot unsubscribe patterns
- Safely retest product display order in `/pos`
- Consider package selection Phase 3 if Free/Pro/Premium plans need to become selectable beyond Premium Trial

## Notes

- Every important record must include `tenantId`.
- Do not sync POS across tenants.
- Use the same stable sale/order id online and offline.
- Firestore transactions must read all documents before writes.
- If imported JS/CSS changes, bump query string.
- If `storage.rules` changes, deploy with `firebase deploy --only storage`.