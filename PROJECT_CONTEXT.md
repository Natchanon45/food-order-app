# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `POS Users Direct Firestore Source`

## This Change

- `/pos/users` now reads users directly from Firestore instead of localStorage fallback.
- Sources are tenant users, tenant memberships, and root users for the active tenant.
- The page filters only Retail POS staff records.
- After load, it refreshes tenant users and local cache from Firestore data.
- No POS sale, stock, sync, or transaction logic changed.

## Test

1. Deploy hosting.
2. Hard refresh `/pos/users`.
3. Confirm Retail POS staff appears from Firestore.
4. Confirm stale deleted users do not return from localStorage.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```