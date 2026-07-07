# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.68
Build: 2026.07.07.012
Milestone: POS Expanded Cart Visible Rows

Change: expanded the `/pos` cart list height so the sale panel can show about 1-2 more visible cart rows while keeping the payment button anchored at the bottom. The desktop product grid still fits 12 images per row on 1920px-wide screens.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus POS expanded cart visible rows polish.

Usage: open `/pos` on desktop and verify the payment button stays anchored at the bottom, the cart item list shows about 1-2 more rows than the previous build while still scrolling normally when full, and a 1920px-wide screen shows 12 product image cards per row. POS continuous scanner support remains unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
