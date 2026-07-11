# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.40
Build: 2026.07.11.010
Milestone: Tax Sync Source Filter Semantics

Change: tax invoice history source filter semantics now separate `Firestore` as remote-only rows, `เครื่องนี้` as local-only rows, and `ทั้งสอง` as rows found in both sources, keeping live counts and combined search/sync filtering display-only without mutating source sale, VAT, payment, stock, duplicate protection, or Firestore transaction behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, use the source filter chips, and confirm `Firestore` excludes local copies, `เครื่องนี้` excludes remote copies, and `ทั้งสอง` shows only merged local/remote rows.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify source filter chip counts reflect remote-only, local-only, and both-source rows on production tax invoice history.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
