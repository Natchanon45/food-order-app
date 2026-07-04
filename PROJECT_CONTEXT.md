# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `Register Premium Pricing Copy`

## This Change

- Updated `/register` premium package price copy.
- Premium now shows free first month and 590 THB for next months.
- Side premium card now shows monthly follow-up price and yearly special price.
- Free and Pro cards are disabled again for now.
- Premium remains the only selectable package.
- UI-only change. No signup function, auth function, POS sale, stock, sync, or transaction logic changed.

## Test

1. Deploy hosting.
2. Hard refresh `/register`.
3. Confirm Free and Pro cards are disabled.
4. Confirm Premium pricing text is correct.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```