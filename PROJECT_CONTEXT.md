# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.73
Build: 2026.07.07.017
Milestone: POS Local UI Font and Menu Icon Cleanup

Change: added local Kanit UI font files for Thai sans/no-head rendering across POS screens and removed the duplicate menu icon on the Retail POS header button.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage and menu icon cleanup.

Usage: open POS web pages and verify buttons, forms, Customer Display, and tax invoice history use `Kanit Local` from `/assets/fonts/`. Open the Retail POS menu and verify the header menu button has one Bootstrap icon and submenu expand/collapse uses Bootstrap chevrons. Open receipt and full tax invoice print pages and verify printable paper areas still use `TH Sarabun PSK Local` from `/assets/fonts/`.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
