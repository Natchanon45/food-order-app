# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `POS Ghost User Cleanup`

## This Change

- POS users page no longer falls back to stale `settings/users` array.
- POS users page now uses `tenants/{tenantId}/users` as the source of truth.
- When loaded, it rewrites `settings/users` from current POS users to clear stale entries.
- Local `retail_pos_users_v1` cache is refreshed from current POS users.
- No POS sale, stock, sync, or transaction logic changed.

## Manual Check

If a POS user still appears, check:
- Authentication > Users
- Firestore `users/{uid}`
- Firestore `tenants/{tenantId}/memberships/{uid}`
- Firestore `tenants/{tenantId}/users/{uid}`
- Firestore `tenants/{tenantId}/settings/users`
- Browser localStorage keys `retail_pos_users_v1` and `retail_db_cache_<tenantId>_users`

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only functions,hosting
```