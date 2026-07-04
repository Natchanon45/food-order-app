# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `Register Layout Validation Fix`

## This Change

- Fixed `/register` layout distortion from inline validation.
- Field errors now stay inside their own label instead of becoming grid items.
- Bumped `public-register.js` to `v=20260705-005`.
- UI/validation-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```