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
- Signup Email Verification Hotfix done
- Register Existing Auth Email + Layout Hotfix done
- Register Slug Pattern Hotfix done

## Current Milestone

`Public Registration Phase 1`

## This Change

- Removed the invalid HTML slug pattern from `/register/` that caused Chrome to log a pattern regular-expression error.
- Kept slug normalization in `public-register.js` as the source of truth.
- Bumped `/register/` script to `public-register.js?v=20260704-004`.
- Note: If an email still exists in Firebase Authentication and the entered credential does not match that Auth user, Firebase will reject sign-in. Delete the user from Authentication > Users or use the original credential.
- Requires deploying hosting.

## Regression Tests

1. Deploy hosting.
2. Open `/register/` with hard refresh.
3. Confirm there is no slug pattern error in Console.
4. Test an existing Firebase Auth email with correct and incorrect credentials.
5. Confirm the form remains readable on desktop and mobile.
6. Confirm existing POS, stock, sync, and tenants are unchanged.

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