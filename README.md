# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Register Inline Validation`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- `/register` now shows red inline validation text under required fields.
- Validation appears after submit attempt and clears while typing.
- Terms checkbox also has inline validation.
- Bumped `public-register.js` to `v=20260705-003`.
- UI/validation-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```