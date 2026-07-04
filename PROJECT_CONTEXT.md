# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `Register Form Polish`

## This Change

- Updated `/register` input fields to use a light gray base background.
- Phone field accepts digits only and formats to `x-xxxx-xxxx-x` after entry.
- Checkbox validation text now says `กรุณายอมรับข้อตกลงและนโยบายการใช้งาน`.
- Yearly old price uses a black 1px diagonal slash effect.
- Bumped `public-register.js` to `v=20260705-006`.
- UI/validation-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```