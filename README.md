# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Keypad Input Polish`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- Polished PC-only POS keypad sizing.
- Removed keypad icon decoration more aggressively.
- Improved decimal input behavior.
- Payment received input now selects all on focus/click before keypad entry.
- Mobile keeps native keyboard.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```