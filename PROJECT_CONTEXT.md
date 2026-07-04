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

## Current Milestone

`Public Registration Phase 1`

## This Change

- Improved `/register/` email verification handling.
- The registration client now attempts to send the verification email before saving pending signup data.
- Added clearer error messages for verification email issues such as unauthorized continue URL or too many requests.
- Resend verification now reloads the current auth user and tells users to check Inbox and Spam/Junk.
- Bumped `/register/` script to `public-register.js?v=20260704-002`.
- Requires deploying hosting. If signup functions are not yet deployed, deploy functions too.

## Regression Tests

1. Deploy `functions,hosting` if functions are not already current; otherwise deploy hosting.
2. Open `/register/` directly with a fresh browser session.
3. Register a new shop with a unique email and slug.
4. Confirm the verification email send result is visible.
5. If no email arrives, check the displayed error and Firebase Auth Authorized domains.
6. Confirm activation still waits for email verification.
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