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

## Current Milestone

`Public Registration Phase 1`

## This Change

- Improved `/register/` for existing Firebase Auth email cases.
- If signup email already exists in Firebase Auth, the client tries to sign in with the entered credential and continue the verification flow.
- If sign in fails, the UI explains that the account still exists in Firebase Authentication and must be removed from Authentication Users or retried with the original credential.
- Improved `/register/` layout: wider shell, narrower plan card, compact hero, full-width email field, better mobile collapse, and less vertical crowding.
- Bumped `/register/` script to `public-register.js?v=20260704-003`.
- Requires deploying hosting. Functions do not need redeploy if already deployed for Public Registration Phase 1.

## Regression Tests

1. Deploy hosting.
2. Open `/register/` with hard refresh.
3. Try a new email and confirm signup still sends verification.
4. Try an email that exists only in Firebase Auth and confirm it continues if the credential matches.
5. Try an existing Auth email with the wrong credential and confirm the message explains Firebase Authentication cleanup.
6. Confirm the form is readable on desktop and mobile.
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