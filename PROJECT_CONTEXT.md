# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `POS Logout Password Fix`

## This Change

- Deprecated `/pos/login` now auto-forwards to `/login?next=/pos/`.
- Added Retail POS staff callable for Firebase Auth password sync.
- POS users save now calls the Firebase Auth sync function.
- Added a POS logout capture fallback through POS icons script.
- No POS sale, stock, sync, or transaction logic changed.

## Test

1. Deploy functions and hosting.
2. Logout from POS menu and confirm it goes to `/login?next=/pos/`.
3. Change a POS user password in `/pos/users`.
4. Login with the new password at `/login?next=/pos/`.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only functions,hosting
```