# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `POS Desktop Numeric Pad Trial`

## This Change

- Added PC-only numeric keypad inside POS payment modal.
- Keypad supports payment received input.
- Keypad can target customer search input when available.
- Mobile keeps native OS keyboard.
- UI-only trial.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```