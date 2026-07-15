# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.72
Build: 2026.07.15.015
Milestone: Catalog Import Review Reasons

Change: Improved `/pos/catalog` preview status clarity by showing a short review reason under each catalog status badge. Ready rows now explain that barcode and verification source are present, duplicate rows explain that SKU or barcode already exists in the tenant store, and draft rows show missing review inputs such as real barcode, verification source, or product image. This is preview guidance only and does not change category selection, import payload rules, tenant product fields, stock, VAT, payments, offline sale sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/catalog`, sign in as Owner, and verify the preview table status column shows a second-line reason below `พร้อมนำเข้า`, `มีในร้านแล้ว`, or `รอตรวจสอบ`. Draft rows should explain missing `Barcode จริง`, `แหล่งตรวจสอบ`, or `รูปสินค้า` when those fields are absent.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/catalog` loads `/assets/css/retail-catalog-import.css?v=20260715-015`, `/assets/js/retail-catalog-import.js?v=20260715-015`, and the Developer Panel shows Catalog Import Review Reasons.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
