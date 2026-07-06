# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.60
Build: 2026.07.07.004
Milestone: P9-B006-15 Customer Display Font Rollback

Change: rolled back the unintended Customer Display font/layout override from the local print font CSS. Customer Display no longer loads `retail-pos-font-local.css`, and that shared CSS no longer targets `.display-shell` or related customer display elements. TH Sarabun PSK Local remains scoped to printable paper surfaces only: `.receipt` and `.tax-paper`.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through customer display font rollback.

Usage: open `/pos/customer-display?displayId=display-pc-01` and verify the Customer Display layout returns to its original sizing. Receipt and full tax invoice paper should still use TH Sarabun PSK Local.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
