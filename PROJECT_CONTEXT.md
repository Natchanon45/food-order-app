# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.69
Build: 2026.07.15.012
Milestone: Catalog Import Readiness UI

Change: Improved `/pos/catalog` so the Retail Master Catalog import flow clearly explains why there may be no products left to import. The page now shows a readiness summary for selected products, verified importable products, products skipped because SKU/barcode already exists in the tenant store, and draft items waiting for verification. The import button text also distinguishes "already skipped" from a genuinely empty ready catalog. This is a presentation/readiness calculation only and does not change tenant product fields, stock, VAT, payments, offline sale sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/catalog`, sign in as Owner, and verify the category panel shows selected count, ready count, importable count, skipped-existing count, and review-pending count. With "ข้าม SKU ที่มีอยู่แล้ว" enabled, a store that already imported all ready catalog items should show that ready items were skipped because they already exist instead of implying the catalog is broken.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/catalog` loads `/assets/css/retail-catalog-import.css?v=20260715-012`, `/assets/js/retail-catalog-import.js?v=20260715-012`, and the Developer Panel shows Catalog Import Readiness UI.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
