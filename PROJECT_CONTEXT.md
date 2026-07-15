# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.66
Build: 2026.07.15.009
Milestone: Colorful Menu Icons

Change: Added color-coded Bootstrap Icon accents across the Retail POS drawer menu groups and menu links, with matching color treatment for primary Order/Delivery heading icons. The change keeps the main green/black/white theme, prevents adjacent duplicate icons in menu links and buttons, keeps printable bill/tax headers text-only, and does not use emoji. This does not change tenant product fields, stock, VAT, payments, offline sale sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos`, click `เมนู`, and verify the drawer menu groups and menu links show distinct colored Bootstrap Icon chips without adjacent duplicate icons. Open `/order` and `/delivery` to verify key heading icons have color accents while the overall layout remains green/black/white.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos` loads `retail-pos-navigation.js?v=20260715-009`, `/assets/css/retail-pos-navigation.css?v=20260715-009`, `/order` and `/delivery` load `/assets/css/icons.css?v=20260715-009`, and the Developer Panel shows Colorful Menu Icons.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
