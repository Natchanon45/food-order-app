# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.15
Build: 2026.07.08.028
Milestone: Admin Report Card Action Fix

Change: kept the admin sales report card as a direct report action without a collapse/expand button, while preserving collapsed-on-load behavior for the other admin cards.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/admin` after a hard refresh. The `รายงานยอดขาย` card should not show a collapse/expand chevron and should be opened through the eye/report button only. Delivery, Takeaway, store, payment, menu, table, and sorting cards should start collapsed. Expanding a card should work for the current session, but reloading the page should collapse it again.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/admin` sales report card action-only behavior plus first-load collapsed-card behavior for the remaining cards.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
