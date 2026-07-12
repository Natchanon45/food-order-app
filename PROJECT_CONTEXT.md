# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.48
Build: 2026.07.12.007
Milestone: Tax Profile Dialog Visual Refresh

Change: tax invoice history now has a refreshed white/green POS layout, clearer panels, and a wider two-column customer tax profile dialog with a profile sidebar, grouped buyer fields, and a cleaner action bar. This is visual-only and does not mutate source sale, VAT, payment, stock, duplicate protection, retry counters, tax buyer profile data shape, or Firestore transaction behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, click `โปรไฟล์ภาษีลูกค้า`, and verify the dialog renders as a wider two-column layout with saved profiles on the left and editable buyer tax fields on the right.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/tax-invoices/` loads the refreshed layout and profile dialog on production.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
