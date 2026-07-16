# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.82
Build: 2026.07.16.007
Milestone: Tax Invoice A4 Pagination Polish

Change: Polished the full tax invoice print page for A4 output. Seller and buyer tax ID rows now append the branch/head-office label on the same line, the document metadata box is tightened so invoice number/date/source receipt values wrap within their own value column, and the toolbar actions now include Bootstrap Icons. Printed full tax invoices repeat the header and buyer block on every page, cap item rows at 10 per page, and keep totals plus signature lines only on the final page so the footer does not fall onto a separate blank page.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, open or issue a full tax invoice, then open `/pos/tax-invoice/?invoiceId=...&auto=0`. Use the print preview to confirm each A4 page shows the full header and buyer section, no page has more than 10 item rows, and totals/signatures appear only on the final page.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Previous build note: POS Local First Loyalty Receipt from build `2026.07.16.006` remains unchanged for local-first POS checkout, stable saleId sync, local stock idempotency, and first-render customer/member plus loyalty rows.

Next Task: deploy hosting and verify `/pos/tax-invoice/` loads `/assets/js/retail-pos-tax-invoice-window.js?v=20260716-007`; open a full tax invoice with more than 10 lines in print preview and confirm the header repeats on page 2, rows are capped at 10 per page, and totals/signatures stay on the final page.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
