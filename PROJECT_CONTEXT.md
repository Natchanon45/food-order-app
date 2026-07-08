# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.12
Build: 2026.07.08.025
Milestone: POS Developer Panel Tax Sync Build Alignment

Change: refreshed POS Developer Panel app-info metadata and cache chain so the panel reports the latest full-tax-invoice offline void sync build after hosting deploy.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: deploy hosting, hard refresh a POS page that loads the shared toast/status module, and open the Developer Panel. It should report version 0.14.12, build 2026.07.08.025, and the tax sync build alignment milestone while preserving the full-tax-invoice offline void sync behavior from the previous build.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting, verify Developer Panel metadata on `/pos` and `/pos/tax-invoices/`, then test a locally issued full tax invoice that is voided before sync and confirm it reaches Firestore as void.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
