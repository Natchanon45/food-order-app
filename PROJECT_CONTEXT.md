# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.75
Build: 2026.07.15.018
Milestone: Catalog Import Result Actions

Change: Added post-import result actions to `/pos/catalog`. After a successful Retail Master Catalog import, owners now see a structured success panel with imported count, the first imported SKU/name rows, a link to review products, and a copy-SKU action for the imported batch. This is import-result UI only and does not change import payload rules, tenant product fields, stock, VAT, payments, offline sale sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/catalog`, sign in as Owner, import a small set of ready catalog rows, and verify the success panel shows imported count, imported SKU/name examples, `ไปตรวจสินค้าที่นำเข้า`, and `คัดลอก SKU`. Confirm the copied SKU list contains the imported master product IDs and the imported products still default to stock 0 and hidden from POS.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/catalog` loads `/assets/css/retail-catalog-import.css?v=20260715-018`, `/assets/js/retail-catalog-import.js?v=20260715-018`, and the Developer Panel shows Catalog Import Result Actions.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
