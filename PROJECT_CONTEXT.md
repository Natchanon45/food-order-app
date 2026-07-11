# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.42
Build: 2026.07.12.001
Milestone: Tax Sync Clear Filters

Change: tax invoice history now shows a `ล้างตัวกรอง` action in the empty state when search, sync status, or source filters hide all rows, resetting the page back to all invoices without mutating source sale, VAT, payment, stock, duplicate protection, or Firestore transaction behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, apply any search/status/source filter combination with zero results, then click `ล้างตัวกรอง` to return to all invoices.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify the empty-state `ล้างตัวกรอง` action clears search, sync status, and source filters on production tax invoice history.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
