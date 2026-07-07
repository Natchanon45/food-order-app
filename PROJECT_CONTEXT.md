# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.80
Build: 2026.07.07.024
Milestone: POS Mobile Product Card Overlay

Change: updated Retail POS product image cards so mobile defaults to image-only like desktop, reveals name/stock/price only during touch/focus/explicit overlay states, and uses dark green price text in the product overlay.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, and mobile product image-card overlay tuning.

Usage: open `/pos` and verify the Retail POS product grid shows image-only cards by default on desktop and mobile. On desktop, hover/focus should reveal name, stock, and price. On mobile, details should stay hidden until touch/focus/explicit overlay state. Verify the overlay price uses dark green text, buttons and forms still use `Kanit Local` from `/assets/fonts/`, POS menu group expand/collapse buttons still show exactly one Bootstrap chevron, and receipt/full tax invoice print pages still use `TH Sarabun PSK Local` from `/assets/fonts/`.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
