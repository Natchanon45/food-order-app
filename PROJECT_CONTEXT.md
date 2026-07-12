# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.44
Build: 2026.07.12.003
Milestone: Tax Sync Filter Deep Link

Change: tax invoice history deep links now support `q`, `sync`, and `source` query parameters, and `คัดลอก Sync` recovery URLs include the best matching sync/source filters for the invoice so support can reopen a narrower recovery context without mutating source sale, VAT, payment, stock, duplicate protection, retry counters, or Firestore transaction behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/?q=<invoiceId-or-number>&sync=error&source=local` to preload search plus filter chips, or click `คัดลอก Sync` on a retryable invoice and use the copied `Tax History` URL for support review.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/tax-invoices/?q=...&sync=...&source=...` preloads search/filter chips and `คัดลอก Sync` includes the filtered `Tax History` recovery URL on production.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
