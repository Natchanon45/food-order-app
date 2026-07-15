# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.78
Build: 2026.07.16.003
Milestone: POS Receipt Reliability Repair

Change: Repaired Retail POS receipt reliability around checkout speed, old sync rows, customer/member display, loyalty points, late full-tax invoice lookup, and sale-history receipt reprints. POS checkout restores the cashier UI immediately after the sale is saved and opens the receipt popup without blocking the save button. Receipt print windows and sale-history reprints recover customer/member rows and loyalty rows from local customer/ledger cache if those fields were patched after the sale row was first created. Sale-history receipt reprints now fill shop address, phone, tax ID, and branch. The offline sync worker checks both saleId and sale number against Firestore before retrying an old local queue row. Late full-tax invoice issuing from `/pos/tax-invoices` now has a DBD lookup button beside buyer tax ID.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/sales`, view a sale that has customer/member data, and verify the receipt detail shows masked print-safe customer name and phone. Open `/pos/receipt/?saleId=<saleId>&auto=0` for the same sale and confirm the paper view uses the same masking. For later full tax invoices, open `/pos/tax-invoices/` from the POS drawer menu item `ใบกำกับภาษี`, search the original POS sale number or receipt number, then issue/reopen the one full tax invoice allowed for that sale.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos` loads `/assets/js/retail-pos.js?v=20260716-003`, `/assets/js/retail-offline-sale-sync.js?v=20260716-003`, and `/assets/js/retail-pos-sync-status.js?v=20260716-003`; `/pos/sales` loads `/assets/js/retail-sales-receipt-enhancer.js?v=20260716-003`; `/pos/receipt` loads `/assets/js/retail-pos-receipt-window.js?v=20260716-003`; `/pos/tax-invoices` loads `/assets/js/retail-pos-tax-invoices.js?v=20260716-003`; and the Developer Panel shows POS Receipt Reliability Repair.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
