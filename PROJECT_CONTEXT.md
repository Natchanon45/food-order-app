# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.83
Build: 2026.07.16.008
Milestone: Tax Invoice Page Count And Receipt Reprint

Change: Updated the full tax invoice print page to fit up to 20 item rows per A4 page, show page numbers as `หน้า n/m`, and remove external icon CSS from the printable window to avoid print-preview stalls. Sale-history receipt detail now uses the same receipt item columns as checkout receipts (`รายการ`, `ราคา`, `รวม`) with quantity inline in the item name, and reprinting a historical bill opens the canonical `/pos/receipt/` print window so the shop header and address render consistently.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, open or issue a full tax invoice, then open `/pos/tax-invoice/?invoiceId=...&auto=0`. Use the print preview to confirm each A4 page shows the full header and buyer section, no page has more than 20 item rows, page numbers read `หน้า 1/2` etc., and totals/signatures appear only on the final page. Open `/pos/sales/`, click `ดูบิล`, and verify item rows show `ชื่อสินค้า x จำนวน`, unit price, and line total; click `พิมพ์ใบเสร็จ` to open the same `/pos/receipt/` print page used after checkout.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Previous build note: Tax Invoice A4 Pagination Polish from build `2026.07.16.007` remains unchanged for seller/buyer branch text, compact metadata box wrapping, repeated invoice headers, and final-page-only totals/signatures.

Next Task: deploy hosting and verify `/pos/tax-invoice/` loads `/assets/js/retail-pos-tax-invoice-window.js?v=20260716-008`; open a 20-item invoice and confirm Chrome/Edge PDF preview is one A4 page, then open a 29-item invoice and confirm two pages with `หน้า 1/2` and `หน้า 2/2`. Verify `/pos/sales/` receipt reprint opens `/pos/receipt/?saleId=...&auto=1` and includes the shop header.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
