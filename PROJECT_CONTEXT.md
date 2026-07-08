# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.08
Build: 2026.07.08.021
Milestone: POS Local Stock Deduction Idempotency

Change: hardened local POS sale persistence so saving the same stable saleId again reuses the existing local sale and does not deduct local stock or append duplicate stock movement rows.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: complete a POS sale online or offline and keep the same stable saleId through local save, receipt, and later Firestore sync. If a duplicate local save is attempted for an already-saved saleId, the local sale row is preserved while product stock and local stock movements remain unchanged, preventing duplicate stock deduction before offline sync reaches Firestore.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test local POS duplicate-save behavior by confirming one local sale, one stock deduction, one stock movement per product, and normal offline sync to Firestore for the same stable saleId.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
