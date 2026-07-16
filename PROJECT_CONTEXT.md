# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.85
Build: 2026.07.16.010
Milestone: Tax Buyer DBD And Validation Layout Polish

Change: Improved the tax invoice history open/print button contrast so text remains readable, added DBD lookup and manual DBD link copy fallback to the tax buyer edit dialog, and stabilized `/pos/products/` validation so product code/barcode inputs keep their height while scanner icons stay vertically centered.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/` and verify the `เปิด/พิมพ์` button remains readable, then click `แก้ผู้ซื้อ` and confirm the DBD button can search by a 13-digit tax ID or show a manual DBD copy fallback. Open `/pos/products/` and trigger required-field validation to confirm product code/barcode rows do not grow taller and the barcode scanner icon remains centered.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Previous build note: Print Icon And Mobile Validation Polish from build `2026.07.16.009` remains unchanged for tax invoice history action icons, prewarmed print windows, scanner-row validation feedback, and `/admin/users` mobile horizontal scrolling.

Next Task: deploy hosting and verify `/pos/tax-invoices/` and `/pos/products/` load the `20260716-010` cache-busted assets.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
