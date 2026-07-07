# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.67
Build: 2026.07.07.011
Milestone: POS Fixed Cart Footer Position

Change: fixed the `/pos` cart footer position so the payment button no longer moves upward when cart item count changes. The cart list remains scrollable at roughly 4-5 visible rows, and the desktop product grid still fits 12 images per row on 1920px-wide screens.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus POS fixed cart footer position polish.

Usage: open `/pos` on desktop and verify the payment button stays at the same bottom position when items are added or removed, the cart item list scrolls normally with about 4-5 visible rows depending on screen height, and a 1920px-wide screen shows 12 product image cards per row. POS continuous scanner support remains unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
