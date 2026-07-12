# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.47
Build: 2026.07.12.006
Milestone: Tax Copy Link Clipboard Fallback

Change: tax invoice history copy actions now fall back to the legacy textarea copy path when the browser exposes Clipboard API but blocks `writeText`, so `คัดลอกลิงก์มุมมอง` and `คัดลอก Sync` remain usable for support handoff without mutating source sale, VAT, payment, stock, duplicate protection, retry counters, or Firestore transaction behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/?q=<invoiceId-or-number>&sync=error&source=local`, adjust search or filter chips, then click `คัดลอกลิงก์มุมมอง` to copy the current support review URL. If the browser blocks Clipboard API, the page retries through the legacy textarea copy fallback.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify the tax invoice history copy actions load `retail-pos-tax-invoices.js?v=20260712-006` on production.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
