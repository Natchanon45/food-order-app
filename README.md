# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Register Terms Polish`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- Terms checkbox and text are aligned on one row on PC.
- Yearly price now shows 7080 with strikethrough before 5900 THB/1 Year.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```