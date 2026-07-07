# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.82
Build: 2026.07.07.026
Milestone: POS Payment Modal Visual Tuning

Change: refined the Retail POS payment modal by reducing numeric font weight, softening payment total/change emphasis, and adding subtle green and amber visual accents while keeping UI button text at font-weight 500 or lighter.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, and payment modal visual tuning.

Usage: open `/pos`, add products, open the payment modal, and verify the total, received amount, change amount, and numeric pad use lighter numeric weights with soft green/amber accents. Verify buttons and forms still use `Kanit Local` from `/assets/fonts/`, UI button text stays at 500 or lighter, POS menu group expand/collapse buttons still show exactly one Bootstrap chevron, and receipt/full tax invoice print pages still use `TH Sarabun PSK Local` from `/assets/fonts/`.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
