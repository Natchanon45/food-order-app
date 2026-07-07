# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.85
Build: 2026.07.07.030
Milestone: POS Payment Customer and Display Layout Tuning

Change: fixed Retail POS payment modal customer clearing and tuned Customer Display PC layout. The customer search X now clears input, selected customer state, note, and dropdown state, while the Customer Display keeps customer and total cards stacked left with the cart card separate right.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, and Customer Display PC stacked-left layout tuning.

Usage: open `/pos`, add items, open the payment modal, select a customer, and use the X in the customer search field to verify the field returns to general customer without leaving stale customer state. Open `/pos/customer-display/` on PC width to verify the customer and total/payment cards are stacked on the left and the cart card stays separate on the right with matching column height. Verify PromptPay QR, receipt behavior, tax invoice history/reprint, stock deduction, offline sync, and printable document fonts remain unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management and add void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
