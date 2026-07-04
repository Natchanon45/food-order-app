# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `POS Receipt Cache Fix`

## This Change

- Updated POS receipt display cache chain.
- Bumped `/pos/index.html` import for `retail-pos-hold.js` to `v=20260705-001`.
- `retail-pos-hold.js` loads `retail-pos-complete.js?v=20260705-001`.
- Display-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```