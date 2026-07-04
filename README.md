# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Register Validation Fix`
- Version/Build: `0.12.70` / `2026.07.02.024`

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