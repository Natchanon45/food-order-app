# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `iOS Receipt Print Fix`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- Fixed iOS receipt print timing.
- PC and Android keep the existing print flow.
- Display/print-only change.

## Note

- Use hard refresh after deploy.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```