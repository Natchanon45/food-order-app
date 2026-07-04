# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `Register Validation Fix`

## This Change

- Fixed `/register` inline validation.
- Disabled native browser validation so red messages under inputs can show.
- Improved yearly price emphasis.
- Bumped `public-register.js` to `v=20260705-004`.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```