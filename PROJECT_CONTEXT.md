# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `Register Terms Polish`

## This Change

- Updated `/register` terms checkbox layout.
- Checkbox and terms text now stay on one row on PC.
- Yearly price now shows the original 7080 price with strikethrough before 5900 THB/1 Year.
- UI-only change. No signup function, auth function, POS sale, stock, sync, or transaction logic changed.

## Test

1. Deploy hosting.
2. Hard refresh `/register`.
3. Confirm terms checkbox and text are on one row on PC.
4. Confirm yearly price shows 7080 with strikethrough and 5900 THB/1 Year.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```