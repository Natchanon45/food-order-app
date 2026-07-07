# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.78
Build: 2026.07.07.022
Milestone: POS Menu Pseudo Chevron Cleanup

Change: removed legacy pseudo chevrons from Retail POS menu group expand/collapse buttons so each group header renders only the single Bootstrap chevron, and bumped the shared POS CSS cache version.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, and POS menu pseudo-chevron cleanup.

Usage: open POS web pages and verify buttons, forms, Customer Display, and tax invoice history use `Kanit Local` from `/assets/fonts/` with UI buttons at font-weight 500 or lighter and form labels/inputs at normal weight. Open the Retail POS menu on `/pos` and verify the header menu button has one Bootstrap icon, the drawer title `เมนู POS` has no leading injected icon even after reload/cache reuse, and each submenu group expand/collapse button shows exactly one Bootstrap chevron with no context icon. Open receipt and full tax invoice print pages and verify printable paper areas still use `TH Sarabun PSK Local` from `/assets/fonts/`.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
