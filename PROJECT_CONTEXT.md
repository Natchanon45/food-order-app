# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.79
Build: 2026.07.07.023
Milestone: POS Theme Alignment

Change: aligned Retail POS visual tone with Order/Delivery by softening panel shadows, moving slate accents back to the shared green/neutral palette, and keeping POS UI headings, buttons, cart labels, menu labels, product hover text, and Customer Display UI weights at 500 or lighter.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, and POS theme alignment with Order/Delivery.

Usage: open `/pos` and verify the Retail POS header, panels, cart, product hover overlays, menu drawer, and Customer Display use the shared Order/Delivery green and neutral tone with lighter shadows and UI text weights of 500 or lighter. Verify buttons and forms still use `Kanit Local` from `/assets/fonts/`, form labels/inputs stay normal weight, POS menu group expand/collapse buttons still show exactly one Bootstrap chevron, and receipt/full tax invoice print pages still use `TH Sarabun PSK Local` from `/assets/fonts/`.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
