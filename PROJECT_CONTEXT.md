# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.67
Build: 2026.07.15.010
Milestone: Colorful Home Menu Icons

Change: Added color-coded icon chips to the central staff dashboard menu cards for Order/Delivery and Retail POS, with matching color accents in the central user menu. The change keeps the main green/black/white theme, prevents adjacent duplicate icons in menu links and buttons, keeps printable bill/tax headers text-only, and does not use emoji. This does not change tenant product fields, stock, VAT, payments, offline sale sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/`, sign in, and verify the Order/Delivery and Retail POS dashboard cards show distinct colored icon chips. Open the user menu and verify the menu icons use matching color accents without adjacent duplicate icons.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/` loads `/assets/css/home-dashboard.css?v=20260715-010`, POS pages load `retail-toast-status.js?v=20260715-010`, and the Developer Panel shows Colorful Home Menu Icons.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
