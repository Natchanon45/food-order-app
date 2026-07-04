# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Mobile Polish`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- Added POS mobile polish CSS override.
- Mobile clear bill button is smaller and aligned right.
- POS mobile submenu expand/collapse indicators now use Bootstrap Icons instead of text glyphs.
- Added `retail-pos-mobile-polish.css?v=20260705-001` to `/pos/index.html`.
- UI-only change. No sale, bill, stock, sync, or auth logic changed.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```