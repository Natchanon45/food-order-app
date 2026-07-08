# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.13
Build: 2026.07.08.026
Milestone: Full Tax Invoice Sync Error Visibility

Change: added local sync error tracking and visible history badges for pending full tax invoices that cannot sync, while keeping the transaction-safe create/void paths unchanged.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: create or void a full tax invoice while offline/local, then return online with intentionally incomplete buyer data or a transaction failure. `/pos/tax-invoices/` should show `Sync Error`, include the concise error on the card/search text, and keep retryable local state until the data or network condition is corrected.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test pending full tax invoice sync failures by confirming `Sync Error` visibility, then retry after correcting buyer data or network state.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
