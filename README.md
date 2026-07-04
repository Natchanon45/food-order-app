# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Register Real Package Radios`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- `/register` package cards now use real visible radio inputs.
- Package cards are clickable and update selected state.
- Replaced text check mark with Bootstrap icon.
- JS reads selected package radio value for future package support.
- Non-premium packages are selectable but blocked on submit for now.
- UI/validation-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```