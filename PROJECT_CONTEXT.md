# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.77
Build: 2026.07.16.002
Milestone: POS Receipt Privacy Masking

Change: Standardized privacy masking for Retail POS printed receipt/customer data. Short tax invoice/receipt print surfaces now share the same customer masking helper for sale-history receipts, popup receipt windows, and customer sale receipts. Customer names print with only the first 3-4 first-name characters visible and only the final 3 surname characters visible; phone numbers print as `098-xxx-xx81`. Saved VAT mode is rendered as an explicit `โหมด VAT` row on receipt print instead of an empty/dash amount.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/sales`, view a sale that has customer/member data, and verify the receipt detail shows masked print-safe customer name and phone. Open `/pos/receipt/?saleId=<saleId>&auto=0` for the same sale and confirm the paper view uses the same masking. For later full tax invoices, open `/pos/tax-invoices/` from the POS drawer menu item `ใบกำกับภาษี`, search the original POS sale number or receipt number, then issue/reopen the one full tax invoice allowed for that sale.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/sales` loads `/assets/js/retail-sales-receipt-enhancer.js?v=20260716-002`, `/pos/receipt` loads `/assets/js/retail-pos-receipt-window.js?v=20260716-002`, POS pages load `/assets/js/retail-toast-status.js?v=20260716-002`, and the Developer Panel shows POS Receipt Privacy Masking.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
