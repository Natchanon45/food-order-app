# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `Register Owner Name Layout`

## This Change

- Updated `/register` layout.
- The owner full name field now spans the full form width like the email field.
- UI-only change.
- No signup, auth, POS sale, stock, sync, or transaction logic changed.

## Test

1. Deploy hosting.
2. Hard refresh `/register`.
3. Confirm `ชื่อ-นามสกุล` width matches the email field.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```