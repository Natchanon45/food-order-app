# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.10
Build: 2026.07.08.023
Milestone: POS Developer Panel Build Alignment

Change: aligned the POS Developer Panel app info with the current Retail POS build and refreshed the app-info cache chain through the POS toast/status loader.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open any POS page that loads the shared toast/status module, then open the Developer Panel. The panel should show version 0.14.10, build 2026.07.08.023, milestone `POS Developer Panel Build Alignment`, and the current app-info commit label while offline sync and stock idempotency behavior remain unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test the Developer Panel on `/pos`, `/pos/settings/`, and `/pos/products/` after hard refresh to confirm the version/build metadata is no longer stale.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
