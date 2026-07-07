# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.65
Build: 2026.07.07.009
Milestone: POS Cart Footer Safe Area

Change: added a stronger `/pos` cart footer safe area so the payment button stays fully visible on desktop browser viewports, while keeping line totals aligned with the quantity +/-/remove controls.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus POS cart footer safe-area polish.

Usage: open `/pos` on desktop and verify the payment button is fully visible with bottom clearance even near the browser bottom edge, and each cart line total aligns vertically with the quantity +/-/remove controls. POS continuous scanner support remains unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
