# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `POS Keypad Input Polish`

## This Change

- Polished PC-only POS keypad sizing.
- Removed keypad icon decoration more aggressively.
- Improved decimal input behavior.
- Payment received input now selects all on focus/click before keypad entry.
- Mobile keeps native OS keyboard.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```