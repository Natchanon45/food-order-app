# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.72
Build: 2026.07.07.016
Milestone: POS Font Coverage and Menu Icons

Change: expanded the Thai sans/no-head UI font standard to standalone POS buttons/forms and replaced Retail POS submenu expand/collapse text carets with Bootstrap Icons.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus POS font coverage and submenu icon cleanup.

Usage: open POS web pages and verify buttons, forms, and Customer Display use the Thai sans/no-head stack. Open the Retail POS menu and verify submenu expand/collapse uses Bootstrap chevron icons instead of `^` or `v`. Open receipt and full tax invoice print pages and verify printable paper areas still use `TH Sarabun PSK Local` from `/assets/fonts/`.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
