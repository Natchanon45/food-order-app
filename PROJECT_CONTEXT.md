# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `Register Package Layout`

## This Change

- Updated `/register` package section to card-style radio options.
- Premium Trial is auto-selected; other package cards are disabled.
- Adjusted form labels and PC/mobile field layout.
- Added terms acceptance checkbox before submit.
- Submit button is disabled until terms are accepted.
- Bumped `public-register.js` to `v=20260705-001`.
- UI/validation-only change. No signup function, auth function, POS sale, stock, sync, or transaction logic changed.

## Test

1. Deploy hosting.
2. Hard refresh `/register`.
3. Confirm package cards and form layout.
4. Confirm submit is disabled until terms checkbox is checked.
5. Confirm signup flow still sends verification email.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```