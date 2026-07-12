# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.50
Build: 2026.07.12.009
Milestone: Tax Sync Health Panel

Change: tax invoice history now shows a `สถานะ Sync ใบกำกับภาษี` diagnostic panel after refresh, summarizing Sync Error, pending sync, stale sync, quality review, and local/Firestore source counts. The panel also records the latest load/sync check and surfaces concise pending tax invoice, buyer profile, or Firestore list errors without changing tax invoice create/void transactions, buyer profile data, source sales, VAT, payment, stock, or retry counters.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, click `รีเฟรช`, and verify the new sync health panel updates from the merged local/Firestore invoice list and shows warnings only when Sync Error, pending, stale, or quality-review rows exist.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/tax-invoices/` loads `retail-pos-tax-invoices.js?v=20260712-009`, then test the sync health panel against normal, pending/local, and Sync Error invoice rows.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
