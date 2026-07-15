# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.70
Build: 2026.07.15.013
Milestone: Catalog Import Filters

Change: Added search and status filters to `/pos/catalog` so owners can inspect the Retail Master Catalog preview by product name, barcode, SKU, brand, category, and readiness state. The preview can now filter all rows, currently importable rows, verified ready rows, rows already in the tenant store, and draft rows waiting for verification. The filters only change the preview table and do not change category selection, import payloads, tenant product fields, stock, VAT, payments, offline sale sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/catalog`, sign in as Owner, and verify the preview section can search by product text and filter by `นำเข้าได้ตอนนี้`, `พร้อมนำเข้า`, `มีในร้านแล้ว`, and `รอตรวจสอบ`. Confirm the readiness summary and import button still follow selected categories plus the skip-existing checkbox, while the preview filters only affect table visibility.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/catalog` loads `/assets/css/retail-catalog-import.css?v=20260715-013`, `/assets/js/retail-catalog-import.js?v=20260715-013`, and the Developer Panel shows Catalog Import Filters.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
