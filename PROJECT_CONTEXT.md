# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.23
Build: 2026.07.09.004
Milestone: Tax Sync Retry Action

Change: tax invoice history cards with `Sync Error`, pending, or local-only sync state now show a direct `ลอง Sync` action. The action reuses the existing pending tax invoice and tax buyer profile sync flow, while preserving source sale, VAT, payment, stock, duplicate protection, and retry behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/` with a local tax invoice that has `syncError`, `pending_create`, `pending_void`, `local_only`, or `local_void`, then confirm the card shows `ลอง Sync`. Click it to retry through the same sync path as page refresh.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify the tax invoice history `ลอง Sync` action on production pending/error cards, then continue pending void retry and online void transaction validation.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
