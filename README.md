# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Shop Name Source Fix`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- Staff home now uses the shop name from store settings first.
- Falls back to tenant profile name only if store settings are empty.
- UI/display-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```