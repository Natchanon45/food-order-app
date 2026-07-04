# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Register Owner Name Layout`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- `/register` owner full name field is now full width.
- It matches the email field width.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```