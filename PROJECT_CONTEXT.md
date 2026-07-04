# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `iOS Receipt Print Fix`

## This Change

- Fixed iOS receipt print gesture timing.
- iOS now calls print directly from the receipt print button when the receipt is already rendered.
- PC and Android keep the existing layout-ready print flow.
- Display/print-only change.

## Note

- Receipt modal script was updated.
- `/pos/index.html` cache version bump was blocked by the connector, so use hard refresh after deploy.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```