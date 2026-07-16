# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.84
Build: 2026.07.16.009
Milestone: Print Icon And Mobile Validation Polish

Change: Polished the tax invoice history and receipt print action buttons with explicit Bootstrap icons, prewarmed receipt and full-tax print pages before opening print preview to reduce endless print-preview spinners, kept validation feedback under compound input rows such as barcode scanner controls, and made the Admin staff list table scroll horizontally on mobile instead of compressing columns.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/` and verify the `เปิด/พิมพ์`, `ดูบิลต้นทาง`, `แก้ผู้ซื้อ`, `คัดลอก Sync`, `ลอง Sync`, and `ยกเลิก` buttons show suitable icons with readable spacing. Open a full tax invoice and a POS receipt print window to confirm print preview opens after the page is ready. Open `/pos/products/` and trigger required-field validation to confirm barcode scanner feedback appears below the barcode row without breaking the input shape. Open `/admin/users` in mobile width and confirm the employee table scrolls left/right instead of clipping columns.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Previous build note: Tax Invoice Page Count And Receipt Reprint from build `2026.07.16.008` remains unchanged for 20-row full-tax invoice pages, page numbers, and sale-history receipt reprint consistency.

Next Task: deploy hosting and verify `/pos/tax-invoices/`, `/pos/receipt/`, `/pos/tax-invoice/`, `/pos/products/`, and `/admin/users` load the `20260716-009` cache-busted assets.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
