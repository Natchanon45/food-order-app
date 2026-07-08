# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.05
Build: 2026.07.08.018
Milestone: Full Tax Invoice A4 Pagination Polish

Change: polished the A4 tax invoice print layout by renaming the printed title to `ใบกำกับภาษี`, changing buyer copy to `ผู้ซื้อ / ลูกค้า`, keeping the sale reference label separate from long bill numbers, and paginating line items at 10 rows per A4 page with repeated headers and totals/signatures on the final page.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoice/?invoiceId=...` for invoices with short and long sale references, then print preview on A4. The page should show `ใบกำกับภาษี`, `ผู้ซื้อ / ลูกค้า`, keep `อ้างอิงบิล` on one label row with long bill numbers wrapping only inside the value column, and display at most 10 item rows per A4 page. If there are more than 10 items, the next page repeats the header/buyer block, continues item 11 onward, and places totals/signatures only on the final page.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test A4 tax invoice print preview with 9, 10, 11, and more than 20 item rows, then continue pending full tax invoice create/void sync validation.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
