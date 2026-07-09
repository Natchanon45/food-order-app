# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.24
Build: 2026.07.09.005
Milestone: Tax Sync Retry Button State

Change: the tax invoice history `ลอง Sync` action now disables itself and shows `กำลัง Sync...` while the existing pending tax invoice and tax buyer profile sync flow is running, reducing duplicate clicks while preserving source sale, VAT, payment, stock, duplicate protection, and retry behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/` with a local tax invoice that shows `ลอง Sync`, click the button, and confirm it becomes disabled with `กำลัง Sync...` while the page refresh/sync flow runs.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify the `ลอง Sync` loading state on production pending/error cards, then continue pending void retry and online void transaction validation.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
