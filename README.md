# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Payment Alignment`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- Aligned PC payment total and keypad.
- Centered keypad OK button.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```