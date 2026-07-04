# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `POS Receipt Print Polish`

## This Change

- Polished POS receipt customer name display.
- Improved mobile print timing for receipt modal.
- Bumped receipt modal script to `v=20260705-002`.
- Display/print-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```