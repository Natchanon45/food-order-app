# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.65
Build: 2026.07.15.008
Milestone: Product Image Storage Fallback

Change: Hardened the Retail POS product image editor for Firebase Storage quota or upload failures. When a staff member selects a new product image but cloud upload fails, the app now saves the compressed image into the local IndexedDB product-image fallback, keeps the existing/product URL intact when available, and lets the product data save continue with a readable Thai warning instead of exposing the raw Firebase Storage error. This does not change tenant product fields, stock, VAT, payments, offline sale sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/products/`, edit a product, choose an image, and save. If Firebase Storage quota is exceeded, the product should still save, the selected image should remain available on the current machine through the local fallback, and the previous URL should remain available for other devices when one exists.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/products/` loads `retail-products.js?v=20260715-008`, `retail-product-merchandising.js?v=20260715-008`, and the Developer Panel shows Product Image Storage Fallback.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
