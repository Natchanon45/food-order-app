# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.58
Build: 2026.07.15.001
Milestone: Tax Icons and POS Image Fallback

Change: `/pos/tax-invoices/` now loads the shared Bootstrap Icons stylesheet so the tax history headings and action buttons can render icons through the existing POS icon enhancer. Retail POS product cards now recover gracefully when a product image URL fails or an invalid image object is encountered, restoring the green initial fallback instead of leaving a broken image icon on the card. This is presentation-only and does not change tenant data, orders, VAT, payments, stock, offline sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/` after a hard refresh and verify that the page heading/buttons show icons without duplicate icon stacks. Open `/pos/` and verify product cards no longer show broken image icons when a product image cannot load; cards should fall back to the green initial tile while the cart, VAT, stock, payment, and offline sync behavior stay unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/tax-invoices/` loads `icons.css?v=20260715-001` and `/pos/` loads `retail-pos-product-card-restore.css?v=20260715-001`, `retail-pos-after-sale-ui-restore.js?v=20260715-001`, and `retail-pos-hold.js?v=20260715-001`.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
