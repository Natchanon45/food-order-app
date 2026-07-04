# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `Register Real Package Radios`

## This Change

- Updated `/register` package cards to use real visible radio inputs.
- Package cards are clickable and update selected state through real radio changes.
- Replaced text check mark with Bootstrap icon.
- `public-register.js` now reads the selected package radio value.
- Non-premium packages are selectable for future support but blocked on submit for now.
- Bumped `public-register.js` to `v=20260705-002`.
- UI/validation-only change. No signup function, auth function, POS sale, stock, sync, or transaction logic changed.

## Test

1. Deploy hosting.
2. Hard refresh `/register`.
3. Click Free, Pro, and Premium package cards and confirm radio selection changes.
4. Confirm only Premium can submit for now.
5. Confirm signup flow still sends verification email.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```