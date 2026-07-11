# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.34
Build: 2026.07.11.004
Milestone: Tax Sync Source Receipt

Change: tax invoice history now gives each invoice with a source sale a `ดูบิลต้นทาง` action and includes the source receipt URL in `คัดลอก Sync`, helping staff compare stuck tax invoice sync states against the original POS receipt without mutating source sale, VAT, payment, stock, duplicate protection, or Firestore transaction behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, confirm invoice cards with a sale reference show `ดูบิลต้นทาง`, and confirm `คัดลอก Sync` includes `Source Receipt` for support handoff without mutating tax invoice sync state.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify the source receipt action plus copied `Source Receipt` line on production tax invoice cards, then continue operator recovery actions for clearing or resolving stuck local/pending tax invoices.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
