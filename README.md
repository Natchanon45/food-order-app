# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Display Update`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- Updated POS print display.
- Updated script cache version.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```