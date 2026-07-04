# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Keypad Trial`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- Added PC-only POS keypad trial.
- Mobile keeps native keyboard.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```