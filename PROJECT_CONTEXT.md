# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.74
Build: 2026.07.15.017
Milestone: Catalog Preview Filter Counts

Change: Added live counts to the `/pos/catalog` preview status dropdown so owners can see how many selected rows are in `ทุกสถานะ`, `นำเข้าได้ตอนนี้`, `พร้อมนำเข้า`, `มีในร้านแล้ว`, and `รอตรวจสอบ` before filtering. Counts refresh from the selected categories and `ข้าม SKU ที่มีอยู่แล้ว` toggle. This is preview/filter UI only and does not change import payload rules, tenant product fields, stock, VAT, payments, offline sale sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/catalog`, sign in as Owner, and verify the preview status dropdown shows live counts such as `นำเข้าได้ตอนนี้ (n)`, `พร้อมนำเข้า (n)`, `มีในร้านแล้ว (n)`, and `รอตรวจสอบ (n)`. Change category selection shortcuts and toggle `ข้าม SKU ที่มีอยู่แล้ว`; confirm the dropdown counts, preview rows, readiness summary, and import button stay aligned.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/catalog` loads `/assets/css/retail-catalog-import.css?v=20260715-017`, `/assets/js/retail-catalog-import.js?v=20260715-017`, and the Developer Panel shows Catalog Preview Filter Counts.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
