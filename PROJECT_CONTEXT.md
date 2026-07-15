# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.79
Build: 2026.07.16.004
Milestone: Delivery COD Edit Unlock

Change: Fixed the Order/Delivery customer checkout payment lock for cash on delivery. `/delivery` now lets customers continue editing the cart after choosing `เก็บเงินปลายทาง`: add items, adjust quantities, edit item notes, change delivery fee option, and change payment method until the final `ยืนยันคำสั่งซื้อ` click. The payment lock and locked total summary remain only for PromptPay / transfer orders where QR/slip totals must stay stable. Restored session drafts also drop stale locks when the method is COD.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open a tenant `/delivery` page, add at least one item, fill recipient details, select `เก็บเงินปลายทาง`, and verify the cart remains editable before pressing `ยืนยันคำสั่งซื้อ`. Switch back to PromptPay / transfer and verify the first click still locks the amount before final confirmation so the QR/slip amount cannot drift.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/delivery` loads `/assets/js/delivery-payment-lock.js?v=20260716-004`, COD checkout remains editable until final confirmation, PromptPay checkout still locks the QR/slip amount before final confirmation, and the Developer Panel metadata shows Delivery COD Edit Unlock where the shared version panel is available.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
