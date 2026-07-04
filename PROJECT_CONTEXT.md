# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `POS Keypad Layout Polish`

## This Change

- Moved PC-only POS keypad to the right side of the payment modal.
- Customer dropdown stays on the left and no longer covers the keypad.
- Removed icon decoration from keypad buttons.
- Mobile keeps native OS keyboard.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```