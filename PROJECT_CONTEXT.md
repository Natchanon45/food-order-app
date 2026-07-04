# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `POS Receipt Privacy`

## This Change

- Updated POS receipt customer display privacy.
- Bumped receipt script import to `v=20260705-001`.
- Display/print-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```