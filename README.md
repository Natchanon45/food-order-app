# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Register Package Layout`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- `/register` package section now uses card-style radio options.
- Premium Trial is auto-selected and other package cards are disabled.
- Updated labels and PC/mobile field layout.
- Added required terms acceptance checkbox before submit.
- Submit button is disabled until terms are accepted.
- UI/validation-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```