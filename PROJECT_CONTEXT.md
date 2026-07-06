# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.59
Build: 2026.07.07.003
Milestone: POS Payment Button Viewport Fit

Change: fixed the `/pos` cart panel viewport fit so the payment button stays visible on desktop-height screens, while the cart list scrolls and still reserves five sale rows on taller screens.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through print font scope polish.

Usage: open `/pos` on desktop and verify the payment button remains visible without page scrolling. On taller desktop screens, the cart list should still show at least five sale rows before scrolling.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
