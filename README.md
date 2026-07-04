# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Keypad Layout`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- Updated PC-only POS keypad layout.
- Mobile keeps native keyboard.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```