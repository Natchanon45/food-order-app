# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.76
Build: 2026.07.07.020
Milestone: POS Menu Legacy Icon Guard

Change: added a legacy DOM guard so the Retail POS drawer title cannot show an injected menu icon even when `/pos` has a cached navigation module, and bumped POS navigation/icon/CSS cache versions after production browser verification.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, and POS legacy drawer icon guard.

Usage: open POS web pages and verify buttons, forms, Customer Display, and tax invoice history use `Kanit Local` from `/assets/fonts/` with UI buttons at font-weight 500 or lighter and form labels/inputs at normal weight. Open the Retail POS menu on `/pos` and verify the header menu button has one Bootstrap icon, the drawer title `เมนู POS` has no leading injected icon even after reload/cache reuse, and submenu expand/collapse uses Bootstrap chevrons. Open receipt and full tax invoice print pages and verify printable paper areas still use `TH Sarabun PSK Local` from `/assets/fonts/`.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
