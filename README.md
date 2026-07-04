# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Register Layout Validation Fix`
- Version/Build: `0.12.70` / `2026.07.02.024`

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