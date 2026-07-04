# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `Register Inline Validation`

## This Change

- Added inline validation for required fields on `/register`.
- Required fields now show red text under each input after submit attempt.
- Validation also updates when the user types or changes a field.
- Terms checkbox also shows an inline red error when not accepted.
- Bumped `public-register.js` to `v=20260705-003`.
- UI/validation-only change. No signup function, auth function, POS sale, stock, sync, or transaction logic changed.

## Test

1. Deploy hosting.
2. Hard refresh `/register`.
3. Click submit without filling fields.
4. Confirm red validation text appears under each required input.
5. Fill fields and confirm each error clears while typing.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```