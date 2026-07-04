# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Ghost User Cleanup`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- POS users now use `tenants/{tenantId}/users` as the source of truth.
- Removed fallback from stale `settings/users` array.
- Page load rewrites `settings/users` from current POS users to clear stale entries.
- Auth/session fix only. No sale, stock, sync, or transaction logic changed.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only functions,hosting
```