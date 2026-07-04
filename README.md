# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Register Premium Pricing Copy`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- Updated `/register` premium pricing copy.
- Premium shows free first month and 590 THB for next months.
- Side card shows follow-up monthly price and yearly special price.
- Free and Pro cards are disabled again for now.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```