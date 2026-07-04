# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `Unified Login POS Session`

## This Change

- `/login` now tries to prepare a Retail POS session after normal staff login.
- Retail POS users can later open `/pos` without a second login.
- If user has no POS permission, normal `/login` still succeeds.
- `/login?next=/pos/` still requires POS session and shows an error if not allowed.
- No POS sale, stock, sync, or transaction logic changed.

## Test

1. Deploy hosting.
2. Open `/login` and login with a Retail POS user.
3. Open `/pos`; it should not ask for a second login.
4. Login with non-POS user and confirm normal pages still work.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```