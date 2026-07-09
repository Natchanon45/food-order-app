# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.22
Build: 2026.07.09.003
Milestone: Tax Sync Diagnostic Visibility

Change: tax invoice history now shows sync error details with attempt count and latest attempted time on invoice cards, making pending create/void retry diagnostics easier to read while preserving source sale, VAT, payment, stock, duplicate protection, and retry behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/` with a local tax invoice that has `syncError`, `syncAttemptCount`, and `syncAttemptedAt`, then confirm the card shows the `Sync Error` badge plus concise error, retry count, and latest attempt time.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify tax invoice sync diagnostic visibility on production history cards, then continue pending void retry and online void transaction validation.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
