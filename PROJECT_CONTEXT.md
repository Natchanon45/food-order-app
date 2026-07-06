# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.55
Build: 2026.07.06.075
Milestone: P9-B006-13 Tax Invoice VAT Total Display

Change: fixed the Full Tax Invoice print view so the VAT summary row no longer displays a dash. The row now shows the calculated VAT-inclusive total from `totalAmount`, falling back to `beforeVat + vatAmount` when needed. The tax invoice page asset version was bumped to load the updated print script.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through VAT total display fix.

Usage: open a receipt after sale, click `ใบกำกับภาษีเต็มรูปแบบ`, enter tax ID, press `DBD`, then create/print the full tax invoice. The buyer address should remain complete and the VAT total row should show the amount instead of `-`.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
