# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Users Direct Firestore Source`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- `/pos/users` reads users directly from Firestore.
- Sources: tenant users, tenant memberships, and root users for the active tenant.
- Local cache is refreshed after Firestore load.
- No sale, stock, sync, or transaction logic changed.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```