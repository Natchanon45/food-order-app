# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.56
Build: 2026.07.13.004
Milestone: System UI Font Weight Tuning

Change: Order/Delivery and Retail POS now share lighter UI font weights for the local Kanit font so headings, cards, badges, buttons, and product sort rows are easier to read. Shared CSS variables define 400/500/600 as the normal UI scale, `Kanit Local` 700-900 requests resolve to the SemiBold face, heavy 800/900-style product-sort text was reduced, and printable receipt/tax invoice paper font behavior remains unchanged. This is presentation-only and does not change tenant data, orders, VAT, payments, stock, offline sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/delivery/`, `/order/`, `/pos/`, and `/pos/products/` after a hard refresh. Verify that local Kanit text reads lighter across shared UI surfaces, product/category sort rows no longer look overly bold, buttons remain readable at 500, and printable bill/tax headers stay unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/delivery/`, `/order/`, `/pos/`, and `/pos/products/` load `app.css?v=20260713-004`, `retail-pos.css?v=20260713-004`, `retail-toast-status.js?v=20260713-004`, and `retail-products-sort-manager.css?v=20260713-004`.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
