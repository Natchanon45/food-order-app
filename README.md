# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Submenu Icon Polish`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- POS submenu icons now apply on PC and mobile.
- Kept mobile clear bill button polish.
- Bumped POS polish CSS to `v=20260705-002`.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```