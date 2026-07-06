# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.57
Build: 2026.07.07.001
Milestone: POS Modern Panel Layout

Change: modernized the `/pos` working layout with cleaner product and cart panels, refreshed desktop card/list spacing, and reserved cart-list height for at least five sale rows.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through print font scope polish.

Usage: open `/pos` on desktop and verify the cart panel keeps enough vertical room for at least five sale rows while the totals and payment actions remain accessible.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
