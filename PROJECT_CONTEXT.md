# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.62
Build: 2026.07.07.006
Milestone: P9-B006-17 Customer Display QR Style

Change: restyled the Customer Display pairing QR panel. The panel keeps the compact button behavior and shows only on hover or focus, with a larger QR image for easier scanning. The Customer Display CSS asset version was bumped to load the new style.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through Customer Display QR style polish.

Usage: open `/pos/customer-display?displayId=display-pc-01`, hover or focus the `เชื่อมอุปกรณ์` button, and verify the QR panel appears with a larger QR image.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
