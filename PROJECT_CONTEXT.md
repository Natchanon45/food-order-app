# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.73
Build: 2026.07.15.016
Milestone: Catalog Import Category Shortcuts

Change: Added category selection shortcuts to `/pos/catalog` so owners can quickly select all categories, select only categories that contain verified ready catalog rows, or clear the category selection before reviewing/importing. The skip-existing checkbox also refreshes the preview state so the `นำเข้าได้ตอนนี้` filter stays aligned. This is category-selection UI only and does not change import payload rules, tenant product fields, stock, VAT, payments, offline sale sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/catalog`, sign in as Owner, and verify `เลือกทั้งหมด`, `เฉพาะที่พร้อมนำเข้า`, and `ล้างการเลือก` update category cards, readiness counts, preview rows, and import button state. Toggle `ข้าม SKU ที่มีอยู่แล้ว` and confirm the preview/importable counts refresh.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/catalog` loads `/assets/css/retail-catalog-import.css?v=20260715-016`, `/assets/js/retail-catalog-import.js?v=20260715-016`, and the Developer Panel shows Catalog Import Category Shortcuts.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
