# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.84
Build: 2026.07.07.028
Milestone: POS PromptPay QR Payment Display

Change: added PromptPay / transfer QR payment support to Retail POS. Store payment settings now include PromptPay enablement, PromptPay ID, and displayed account name, and POS shows a QR for the payable amount in the payment modal and on Customer Display.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, and PromptPay QR payment display for POS/customer screens.

Usage: open `/pos/settings/` to enable PromptPay, enter the PromptPay ID and displayed account name, then open `/pos`, add items, choose PromptPay / transfer in the payment modal, and verify the QR amount plus shop/source information appears on both POS and Customer Display. Verify receipt behavior, tax invoice history/reprint, stock deduction, offline sync, and printable document fonts remain unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management and add void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
