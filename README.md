# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Payment Keypad Balance`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- Balanced PC payment modal layout.
- Expanded keypad width and spacing.
- Right-aligned payment received input.
- Mobile keeps native keyboard.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```