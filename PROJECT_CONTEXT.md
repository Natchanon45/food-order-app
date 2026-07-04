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
- Milestone: `Public Registration Phase 1`

## Done

- QR Table Order / Take Away / Kitchen / Cashier / Delivery done
- Retail POS supports Online / Offline / Sync / Tenant
- POS Roadmap P9-B001 to P9-B010 done
- POS Hardening 001 done
- POS Hardening 002 done
- Business Unit Staff Filter Fix done
- Public Trial Signup Phase 1 done

## Current Milestone

`Public Registration Phase 1`

## This Change

- Added public Premium trial signup backend functions.
- Added `/register/` page and public registration client flow.
- Added email verification flow before tenant activation.
- Activation creates tenant, owner profile, membership, store settings, POS settings, and trial subscription records.
- Premium trial is currently fixed to 30 days.
- Exported required Firebase Auth helpers from `firebase-config.js`.
- Public landing CTA still needs a follow-up patch because GitHub blocked updating the existing one-line landing file.
- Requires deploying functions and hosting.

## Regression Tests

1. Deploy `functions,hosting`.
2. Open `/register/` directly.
3. Register a new shop with a unique email and slug.
4. Confirm email verification is sent.
5. Confirm activation waits for verification.
6. After verification, confirm tenant and owner records are created.
7. Confirm existing POS, stock, sync, and tenants are unchanged.

## Next Tasks

- Patch public landing `ลงทะเบียน` CTA to `/register/`.
- POS Hardening 003: check duplicate event listeners and snapshot unsubscribe patterns
- Safely retest product display order in `/pos`

## Notes

- Every important record must include `tenantId`.
- Do not sync POS across tenants.
- Use the same stable sale/order id online and offline.
- Firestore transactions must read all documents before writes.
- If imported JS/CSS changes, bump query string.
- If `storage.rules` changes, deploy with `firebase deploy --only storage`.