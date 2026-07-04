# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `POS Mobile Polish`

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