# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Payment Modal UI`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- Updated PC payment modal display.
- Balanced keypad size and spacing.
- Mobile keeps native keyboard.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```