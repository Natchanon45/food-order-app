# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Quick Login Icon Fix`
- Version/Build: `0.12.70` / `2026.07.02.024`

## Done

- Quick Login Icon Fix

## This Change

- Centered the icon inside the quick login badge on the public landing page.
- Added a small style fallback in `home-session-fa.js`.
- UI-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```