# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.66
Build: 2026.07.07.010
Milestone: POS Sticky Payment Footer

Change: changed the `/pos` cart layout so the payment button remains visible as a fixed cart footer, the cart item list scrolls at roughly 4-5 visible rows depending on screen height, and the desktop product grid fits 12 images per row on 1920px-wide screens.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus POS sticky payment footer polish.

Usage: open `/pos` on desktop and verify the payment button is always fully visible, the cart item list scrolls normally with about 4-5 visible rows depending on screen height, and a 1920px-wide screen shows 12 product image cards per row. POS continuous scanner support remains unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
