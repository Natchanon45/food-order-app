# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.35
Build: 2026.07.11.005
Milestone: Tax Sync Buyer Recovery

Change: tax invoice history now lets staff edit buyer data on local/pending create tax invoices through `แก้ผู้ซื้อ`, storing the correction only in the local tax invoice cache so `ลอง Sync` can retry the existing transaction-safe path without mutating source sale, VAT, payment, stock, duplicate protection, or Firestore transaction behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, find a `pending_create` or `local_only` invoice, click `แก้ผู้ซื้อ`, save the buyer name/tax details, and use `ลอง Sync` to retry through the existing tax invoice sync flow without resetting retry counters.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify the `แก้ผู้ซื้อ` local recovery dialog on production pending/local create tax invoice cards, then continue validating tax sync recovery against real stuck local/pending invoices.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
