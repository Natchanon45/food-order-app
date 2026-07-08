# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.18
Build: 2026.07.08.031
Milestone: Tax Invoice Label Consistency

Change: aligned POS receipt and tax invoice history UI wording to use `ใบกำกับภาษี` consistently instead of the longer `ใบกำกับภาษีเต็มรูปแบบ`, while preserving existing duplicate protection, sync, and void behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/receipt/?saleId=...` and confirm the tax action button and buyer dialog use `ใบกำกับภาษี`. Open `/pos/tax-invoices/` and confirm the page title, late-issue panel, empty state, buyer dialog, profile helper text, and void dialog use the same wording.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify POS receipt tax action wording, tax invoice history wording, buyer dialog wording, and void dialog wording on production.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
