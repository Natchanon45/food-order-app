# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.25
Build: 2026.07.09.006
Milestone: Tax Sync Single Flight

Change: pending full tax invoice sync now runs as a single in-flight promise per browser tab, so overlapping calls from page load, online events, receipt popup, or `ลอง Sync` wait for the same create/void retry cycle while preserving source sale, VAT, payment, stock, duplicate protection, and Firestore transaction behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/` and trigger refresh, online reconnect, or `ลอง Sync` repeatedly while pending tax invoices exist; only one pending full tax invoice sync run should execute at a time and later callers should reuse the same result.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify overlapping tax invoice sync triggers on production pending/error cards, then continue online void transaction validation with synced Firestore data.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
