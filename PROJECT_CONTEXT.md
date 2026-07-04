# Food Order App — Project Context

Repository: `Natchanon45/food-order-app`
Branch: `feature/retail-pos`

## Version / Build

- Version: `0.12.70`
- Build: `2026.07.02.024`
- Milestone: `Staff Home Mobile Polish`

## This Change

- Improved staff home mobile layout after login.
- Mobile dashboard cards now use a 2-column layout instead of overly narrow 4 columns.
- Reduced mobile header, hero, card, icon, and label sizes.
- Improved Order/Delivery and Retail POS section headers on mobile.
- UI-only change.

## Note

- `home-dashboard.css` changed directly.
- `public/index.html` query string was not bumped because the file is compressed into very long lines and rewriting it would risk breaking the page.
- After deploy, use hard refresh to clear cached CSS.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```