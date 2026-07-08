# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.09
Build: 2026.07.08.022
Milestone: POS Offline Sync Module Alignment

Change: aligned the POS sync status module with the same offline sale sync worker and local sale repository versions loaded by `/pos`, reducing duplicate module instances from stale browser cache paths.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos` and let the background offline sale sync worker and the visible sync status chip share the same imported worker instance. Manual Sync/Retry should reflect the same queue snapshot as the background worker, while stable saleId duplicate protection and Firestore transaction sync behavior remain unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test `/pos` with pending, failed, and conflict local sales to confirm the sync chip and background worker show the same queue counts and manual retry does not spawn a duplicate stale worker path.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
