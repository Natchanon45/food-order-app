# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `Shop Name Source Fix`

## This Change

- Fixed staff home shop name source.
- Staff home now reads store settings shop name before tenant profile name.
- UI/display-only change.
- No POS sale, stock, sync, or transaction logic changed.

## Test

1. Deploy hosting.
2. Change shop name in `/admin`.
3. Hard refresh `/`.
4. Confirm staff home shows the same shop name.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```