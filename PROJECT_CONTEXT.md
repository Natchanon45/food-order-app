# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.70
Build: 2026.07.07.014
Milestone: POS Tax Invoice Menu Entry

Change: added a direct POS menu entry for full tax invoice history and added a history shortcut on the full tax invoice print page so issued tax invoices can be opened from the web UI without remembering the URL.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus POS tax invoice history navigation.

Usage: open `/pos/`, click the POS menu, and verify `ใบกำกับภาษี` opens `/pos/tax-invoices/`. From `/pos/tax-invoice/`, verify the `ประวัติ` shortcut opens the same history page.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
