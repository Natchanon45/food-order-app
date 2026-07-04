# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `Register Validation Stability`

## This Change

- Stabilized `/register` validation height by reserving error text space.
- Input rows no longer jump when validation appears or clears.
- Adjusted old yearly price: red text with black 1px slash at a softer angle.
- Bumped `public-register.js` to `v=20260705-007`.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```