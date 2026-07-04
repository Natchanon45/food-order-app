# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Logout Password Fix`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- `/pos/login` forwards to `/login?next=/pos/`.
- POS user password changes now sync to Firebase Auth through a callable function.
- POS logout has a fallback to unified login.
- UI/auth fix only. No sale, stock, sync, or transaction logic changed.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only functions,hosting
```